import hashlib
import hmac
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import select

from ..audit import canonical, digest, log
from ..config import settings
from ..models import Dedupe, Record, now
from .analytics import metrics

KINDS = {
    "view",
    "warning_review",
    "network",
    "model",
    "context",
    "investigation",
    "task",
    "subscription",
    "notification",
    "source",
    "attempt",
    "brief_schedule",
    "brief",
}


def records(db, kind, dataset_id=None, owner=None):
    query = select(Record).where(Record.kind == kind)
    if dataset_id:
        query = query.where(Record.dataset_id == dataset_id)
    if owner:
        query = query.where(Record.owner == owner)
    return list(db.scalars(query.order_by(Record.created_at.desc())))


def create(db, user, kind, dataset_id, data, status="new"):
    record = Record(kind=kind, dataset_id=dataset_id, owner=user.id, data=data, status=status)
    db.add(record)
    db.flush()
    log(db, user, "create:" + kind, record.id, {"dataset_id": dataset_id})
    return record


def notify(db, event, record, recipient=None):
    for subscription in records(db, "subscription"):
        config = subscription.data
        if (
            event not in config.get("events", [])
            or (subscription.dataset_id and subscription.dataset_id != record.dataset_id)
            or (recipient and subscription.owner != recipient)
        ):
            continue
        priorities = {"low": 0, "medium": 1, "high": 2, "critical": 3}
        if priorities.get(record.data.get("priority", "medium"), 1) < priorities.get(
            config.get("minimum_priority", "low"), 0
        ):
            continue
        key = f"notice:{subscription.owner}:{event}:{record.id}:{record.version}"
        if db.get(Dedupe, key):
            continue
        notice = Record(
            kind="notification",
            dataset_id=record.dataset_id,
            owner=subscription.owner,
            status="unread",
            data={
                "event": event,
                "evidence_ref": f"record:{record.id}",
                "message": f"{event.replace('_', ' ').title()}: {record.data.get('title', record.kind)}",
            },
        )
        db.add(notice)
        db.flush()
        db.add(Dedupe(key=key, record_id=notice.id))
        log(
            db,
            None,
            "notification:created",
            notice.id,
            {"owner": subscription.owner, "event": event},
        )


def valid_evidence(db, ref, dataset_id):
    from ..models import Dataset, Incident

    if not isinstance(ref, str) or ":" not in ref:
        raise ValueError("A stable evidence reference is required")
    kind, key = ref.split(":", 1)
    obj = db.get(
        {"dataset": Dataset, "record": Record, "incident": Incident}.get(kind, Record), key
    )
    if (
        kind not in {"dataset", "record", "incident"}
        or not obj
        or (obj.id if kind == "dataset" else obj.dataset_id) != dataset_id
    ):
        raise ValueError("Evidence reference does not belong to the selected dataset")


def patch(db, user, record, action, data, expected):
    if record.version != expected:
        raise HTTPException(409, "Record changed. Reload before editing.")
    supervisor = user.role in {"supervisor", "administrator"}
    if record.kind in {"subscription", "notification", "view"} and record.owner != user.id:
        raise HTTPException(404, "Record not found")
    payload = dict(record.data)
    if record.kind == "investigation":
        if record.status == "approved":
            raise HTTPException(409, "Approved investigation is frozen")
        if action in {"approve", "reject"}:
            if not supervisor:
                raise HTTPException(403, "Supervisor required")
            if record.status != "submitted":
                raise HTTPException(409, "Only submitted investigations can be reviewed")
            record.status = "approved" if action == "approve" else "rejected"
            payload["review_note"] = str(data.get("note", ""))
            if action == "approve":
                payload["snapshot_sha256"] = digest(
                    {"dataset_id": record.dataset_id, "content": payload}
                )
        elif record.owner != user.id:
            raise HTTPException(403, "Only the author can edit or submit")
        elif action == "submit":
            if record.status not in {"new", "draft", "rejected"}:
                raise HTTPException(409, "Cannot submit this state")
            record.status = "submitted"
        elif action in {"note", "verification"} and record.status in {"new", "draft", "rejected"}:
            if not data.get("text"):
                raise ValueError("Text is required")
            payload[action + "s"] = payload.get(action + "s", []) + [
                {"text": str(data["text"]), "actor": user.id, "at": now().isoformat()}
            ]
        else:
            raise ValueError("Unsupported investigation action")
    elif record.kind == "task":
        if action == "claim":
            if payload.get("assignee") and payload["assignee"] != user.id:
                raise HTTPException(409, "Task already assigned")
            payload["assignee"] = user.id
        elif action in {"reassign", "sla_override", "escalate"}:
            if not supervisor:
                raise HTTPException(403, "Supervisor required")
            if action == "reassign":
                from ..models import User

                if not db.get(User, data.get("assignee", "")):
                    raise ValueError("Unknown assignee")
                payload["assignee"] = data["assignee"]
            elif action == "sla_override":
                deadline = datetime.fromisoformat(data["due_at"])
                if deadline.tzinfo is None:
                    raise ValueError("Due time requires timezone")
                payload["due_at"] = deadline.isoformat()
            else:
                payload["escalated"] = True
        elif action in {"status", "comment"}:
            if payload.get("assignee") != user.id and not supervisor:
                raise HTTPException(403, "Only owner or supervisor may update")
            if action == "status":
                if data.get("status") not in {"new", "in_progress", "blocked", "done"}:
                    raise ValueError("Invalid task status")
                record.status = data["status"]
            else:
                if not data.get("text"):
                    raise ValueError("Comment text is required")
                payload["comments"] = payload.get("comments", []) + [
                    {"text": data["text"], "actor": user.id, "at": now().isoformat()}
                ]
        else:
            raise ValueError("Unsupported task action")
    elif record.kind == "warning_review" and action == "review":
        if data.get("status") not in {"new", "investigating", "resolved", "dismissed"}:
            raise ValueError("Invalid warning status")
        record.status = data["status"]
        payload["notes"] = payload.get("notes", []) + [
            {"text": str(data.get("note", "")), "actor": user.id, "at": now().isoformat()}
        ]
    elif record.kind == "notification" and action == "read":
        record.status = "read"
        payload["read_at"] = now().isoformat()
    elif record.kind in {"source", "brief_schedule"} and action == "toggle" and supervisor:
        payload["enabled"] = not payload.get("enabled", False)
    else:
        raise ValueError("Unsupported action")
    record.data = payload
    record.version += 1
    log(db, user, action + ":" + record.kind, record.id, data)
    if record.kind == "task":
        notify(
            db,
            "escalation" if action == "escalate" else "assignment",
            record,
            payload.get("assignee"),
        )
    if record.kind == "warning_review":
        notify(db, "warning_change", record)
    return record


def brief_digest(artifact):
    # Keep v1 signatures intact; v2 treats JSON whole-number floats as integers.
    def normalize(value):
        if isinstance(value, dict):
            return {key: normalize(item) for key, item in value.items()}
        if isinstance(value, list):
            return [normalize(item) for item in value]
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return value

    if artifact.get("format") == "crimestack-brief/v2":
        return digest(normalize(artifact))
    return digest(artifact)


def make_brief(dataset, rows, scope):
    artifact = {
        "format": "crimestack-brief/v2",
        "dataset": {
            "id": dataset.id,
            "name": dataset.name,
            "checksum": dataset.checksum,
            "provenance": dataset.provenance,
            "publisher": dataset.publisher,
            "created_at": dataset.created_at.isoformat(),
        },
        "scope": scope,
        "metrics": metrics(rows),
        "quality": dataset.quality,
        "limitations": [
            "Uploaded records are not independently authenticated.",
            "Historical aggregates do not determine guilt or justify enforcement.",
            "Synthetic records, where selected, are fictional.",
        ],
    }
    sha = brief_digest(artifact)
    key_id = settings().signing_key_id
    signature = hmac.new(
        settings().signing_secret.encode(),
        canonical({"sha256": sha, "key_id": key_id}).encode(),
        hashlib.sha256,
    ).hexdigest()
    return {
        "artifact": artifact,
        "manifest": {"sha256": sha, "key_id": key_id, "hmac_sha256": signature},
    }


def verify_brief(data):
    try:
        manifest = data["manifest"]
        secret = (
            settings().signing_secret
            if manifest["key_id"] == settings().signing_key_id
            else settings().previous_signing_keys.get(manifest["key_id"])
        )
        if not secret:
            return {"valid": False, "reason": "Unknown signing key identifier"}
        if not isinstance(data["artifact"], dict):
            raise ValueError("Artifact must be an object")
        sha = brief_digest(data["artifact"])
        signature = hmac.new(
            secret.encode(),
            canonical({"sha256": sha, "key_id": manifest["key_id"]}).encode(),
            hashlib.sha256,
        ).hexdigest()
        return {
            "valid": hmac.compare_digest(sha, manifest["sha256"])
            and hmac.compare_digest(signature, manifest["hmac_sha256"]),
            "sha256": sha,
            "key_id": manifest["key_id"],
        }
    except (KeyError, TypeError, ValueError):
        return {"valid": False, "reason": "Malformed integrity envelope"}


def task_defaults(data):
    if data.get("priority") not in {"low", "medium", "high", "critical"}:
        raise ValueError("Task requires priority")
    hours = int(data.get("sla_hours", 24))
    if not 1 <= hours <= 8760:
        raise ValueError("SLA must be 1–8760 hours")
    return {
        **data,
        "sla_hours": hours,
        "due_at": (now() + timedelta(hours=hours)).isoformat(),
        "assignee": None,
        "comments": [],
    }
