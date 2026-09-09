import asyncio
import logging
from contextlib import asynccontextmanager, suppress
import hashlib
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from sqlalchemy import select, text, update
from sqlalchemy.exc import IntegrityError

from .audit import canonical, log, verify
from .config import settings
from .db import get_db, SessionLocal
from .models import Bootstrap, Dataset, Dedupe, Incident, Record, User, now
from .schemas import (
    BootstrapRequest,
    ChatRequest,
    Credentials,
    RecordCreate,
    RecordPatch,
    UserCreate,
)
from .security import current_user, hasher, password_valid, require, token
from .services.analytics import hotspots, metrics, warnings
from .services.copilot import answer
from .services.patterns import discover
from .services.ingestion import drift, parse_csv
from .services.intelligence import context_analysis, network_analysis, train_model, validate_edges
from .services.workflows import (
    KINDS,
    create,
    make_brief,
    notify,
    patch,
    records,
    task_defaults,
    valid_evidence,
    verify_brief,
)


def scheduled_work():
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.role == "administrator"))
        if user:
            tick(user=user, db=db)
            db.commit()


@asynccontextmanager
async def lifespan(application):
    async def loop():
        while True:
            await asyncio.sleep(max(10, settings().scheduler_interval_seconds))
            try:
                await asyncio.to_thread(scheduled_work)
            except Exception:
                logging.getLogger("crimestack.scheduler").exception("Scheduled tick failed")

    task = asyncio.create_task(loop()) if settings().scheduler_enabled else None
    yield
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="CrimeStack", version="0.2.0", lifespan=lifespan)
login_attempts = defaultdict(deque)


@app.exception_handler(ValueError)
async def value_error(request, exc):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.2.0"}


@app.get("/ready")
def ready(db=Depends(get_db)):
    try:
        version = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
        if version != "0002":
            raise ValueError("Schema not current")
        db.execute(text("SELECT 1 FROM audit_head WHERE id=1"))
        return {"status": "ready", "migration": version}
    except Exception:
        raise HTTPException(503, "Database unavailable or migrations pending") from None


@app.get("/api/auth/status")
def auth_status(db=Depends(get_db)):
    return {"bootstrap_required": db.get(Bootstrap, 1) is None}


@app.post("/api/auth/bootstrap")
def bootstrap(body: BootstrapRequest, db=Depends(get_db)):
    if not secrets.compare_digest(body.bootstrap_secret, settings().bootstrap_secret):
        raise HTTPException(403, "Invalid bootstrap secret")
    if db.get(Bootstrap, 1):
        raise HTTPException(409, "Administrator already bootstrapped") from None
    db.add(Bootstrap(id=1))
    user = User(
        email=body.email.lower().strip(),
        password_hash=hasher.hash(body.password),
        role="administrator",
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Administrator already bootstrapped") from None
    log(db, user, "bootstrap", user.id)
    return {
        "access_token": token(user),
        "user": {"id": user.id, "email": user.email, "role": user.role},
    }


@app.post("/api/auth/login")
def login(body: Credentials, request: Request, db=Depends(get_db)):
    key = (request.client.host if request.client else "local", body.email.lower())
    queue = login_attempts[key]
    while queue and queue[0] < time.monotonic() - 300:
        queue.popleft()
    if len(queue) >= 10:
        raise HTTPException(429, "Too many attempts. Retry in five minutes.")
    queue.append(time.monotonic())
    user = db.scalar(select(User).where(User.email == body.email.lower().strip()))
    if not user or not password_valid(user.password_hash, body.password):
        raise HTTPException(401, "Invalid email or password")
    queue.clear()
    log(db, user, "login", user.id)
    return {
        "access_token": token(user),
        "user": {"id": user.id, "email": user.email, "role": user.role},
    }


@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return {"id": user.id, "email": user.email, "role": user.role}


@app.post("/api/users")
def add_user(body: UserCreate, user=Depends(require("administrator")), db=Depends(get_db)):
    if db.scalar(select(User).where(User.email == body.email.lower().strip())):
        raise HTTPException(409, "Email already registered")
    item = User(
        email=body.email.lower().strip(), password_hash=hasher.hash(body.password), role=body.role
    )
    db.add(item)
    db.flush()
    log(db, user, "user:create", item.id, {"role": item.role})
    return {"id": item.id, "email": item.email, "role": item.role}


@app.get("/api/users")
def users(user=Depends(require("analyst")), db=Depends(get_db)):
    return [{"id": u.id, "email": u.email, "role": u.role} for u in db.scalars(select(User))]


def dataset(db, key):
    item = db.get(Dataset, key)
    if not item:
        raise HTTPException(404, "Dataset not found")
    return item


def incident_rows(db, key, district=None, category=None, start=None, end=None):
    dataset(db, key)
    query = select(Incident).where(Incident.dataset_id == key)
    if district:
        query = query.where(Incident.district_code == district)
    if category:
        query = query.where(Incident.category == category)
    if start:
        datetime.fromisoformat(start)
        query = query.where(Incident.occurred_at >= start[:10])
    if end:
        datetime.fromisoformat(end)
        query = query.where(
            Incident.occurred_at
            < (datetime.fromisoformat(end[:10]) + timedelta(days=1)).date().isoformat()
        )
    return [r.data for r in db.scalars(query.order_by(Incident.occurred_at, Incident.incident_id))]


def dataset_json(d):
    return {
        "id": d.id,
        "name": d.name,
        "publisher": d.publisher,
        "provenance": d.provenance,
        "quality": d.quality,
        "checksum": d.checksum,
        "created_at": d.created_at.isoformat(),
    }


async def upload_bytes(file):
    raw = await file.read(settings().max_upload_bytes + 1)
    if len(raw) > settings().max_upload_bytes:
        raise HTTPException(413, "Upload exceeds 10 MB")
    return raw


def import_data(db, user, raw, name, publisher, provenance):
    if not name.strip() or not publisher.strip() or len(name) > 200 or len(publisher) > 200:
        raise ValueError("Name and publisher must contain 1–200 characters")
    rows, quality = parse_csv(raw)
    if not rows:
        raise ValueError("No accepted incident rows")
    item = Dataset(
        name=name,
        publisher=publisher,
        provenance=provenance,
        quality=quality,
        checksum=hashlib.sha256(raw).hexdigest(),
    )
    db.add(item)
    db.flush()
    for row in rows:
        db.add(
            Incident(
                dataset_id=item.id,
                incident_id=row["incident_id"],
                occurred_at=row["occurred_at"],
                category=row["category"],
                district_code=row["district_code"],
                severity=row["severity"],
                latitude=row["latitude"],
                longitude=row["longitude"],
                data=row,
            )
        )
    log(
        db,
        user,
        "dataset:import",
        item.id,
        {"accepted_rows": len(rows), "provenance": provenance, "checksum": item.checksum},
    )
    return item


@app.post("/api/datasets/preview")
async def preview(file: UploadFile = File(...), user=Depends(require("analyst"))):
    rows, quality = parse_csv(await upload_bytes(file))
    return {"quality": quality, "sample": rows[:5]}


@app.post("/api/datasets")
async def import_dataset(
    file: UploadFile = File(...),
    name: str = Form(...),
    publisher: str = Form(...),
    provenance: Literal["uploaded_unverified", "official_declared", "synthetic_demo"] = Form(...),
    user=Depends(require("analyst")),
    db=Depends(get_db),
):
    item = import_data(db, user, await upload_bytes(file), name, publisher, provenance)
    return dataset_json(item)


@app.get("/api/datasets")
def datasets(user=Depends(current_user), db=Depends(get_db)):
    return [
        dataset_json(d) for d in db.scalars(select(Dataset).order_by(Dataset.created_at.desc()))
    ]


@app.get("/api/datasets/{key}/analytics")
def analytics(
    key: str,
    district: str | None = None,
    category: str | None = None,
    start: str | None = None,
    end: str | None = None,
    threshold: Literal["sensitive", "standard", "conservative"] = "standard",
    user=Depends(current_user),
    db=Depends(get_db),
):
    rows = incident_rows(db, key, district, category, start, end)
    return {
        "metrics": metrics(rows),
        "hotspots": hotspots(rows),
        "warnings": warnings(rows, threshold),
        "points": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r["longitude"], r["latitude"]]},
                "properties": {
                    k: r.get(k)
                    for k in ["incident_id", "category", "severity", "district_code", "occurred_at"]
                },
            }
            for r in rows
            if r["latitude"] is not None and r["longitude"] is not None
        ],
        "scope": {"district": district, "category": category, "start": start, "end": end},
    }


@app.get("/api/datasets/{key}/patterns")
def patterns(
    key: str,
    district: str | None = None,
    category: str | None = None,
    start: str | None = None,
    end: str | None = None,
    user=Depends(current_user),
    db=Depends(get_db),
):
    from .schemas import Scope

    scope = Scope(district=district, category=category, start=start, end=end)
    result = discover(incident_rows(db, key, **scope.model_dump()))
    result["evidence_ref"] = f"dataset:{key}"
    return result


@app.get("/api/datasets/{key}/compare/{baseline}")
def compare(key: str, baseline: str, user=Depends(current_user), db=Depends(get_db)):
    a, b = dataset(db, key), dataset(db, baseline)
    return drift(
        a,
        b,
        [r["incident_id"] for r in incident_rows(db, key)],
        [r["incident_id"] for r in incident_rows(db, baseline)],
    )


def get_network(db, key, user):
    edges = [edge for r in records(db, "network", key) for edge in r.data["edges"]]
    result = network_analysis(edges, mask=user.role == "viewer")
    result["evidence_refs"] = [f"record:{r.id}" for r in records(db, "network", key)]
    result["evidence_sources"] = [
        {
            "evidence_ref": f"record:{r.id}",
            "provenance": r.data["provenance"],
            "source_name": "Declared relationship import",
        }
        for r in records(db, "network", key)
    ]
    return result


@app.get("/api/datasets/{key}/network")
def network(key: str, user=Depends(current_user), db=Depends(get_db)):
    dataset(db, key)
    return get_network(db, key, user)


@app.get("/api/copilot/capabilities")
def copilot_capabilities(user=Depends(current_user)):
    configured = bool(settings().llm_api_key and settings().llm_model)
    return {
        "mode": "AI tool routing" if configured else "Guided evidence queries",
        "ai_configured": configured,
        "provider_verified": False,
        "description": "AI routing is configured; provider connectivity is checked when you ask a question."
        if configured
        else "Guided English and Kannada queries are available. Configure LLM_API_KEY and LLM_MODEL on the backend for AI routing.",
        "data_requirement": "Results are calculated from imported records; no live KSP connection is configured.",
    }


@app.post("/api/datasets/{key}/copilot")
def copilot(key: str, body: ChatRequest, user=Depends(current_user), db=Depends(get_db)):
    item = dataset(db, key)
    result = answer(
        body,
        item,
        incident_rows(db, key),
        get_network(db, key, user),
        [{"record_id": r.id, **r.data} for r in records(db, "model", key) if r.status == "active"],
        [{"record_id": r.id, **r.data} for r in records(db, "context", key)],
    )
    log(
        db,
        user,
        "copilot:query",
        key,
        {
            "mode": result["mode"],
            "refused": result.get("refused", False),
            "tool": result.get("tool"),
            "scope": result.get("context"),
            "evidence_refs": [c["evidence_ref"] for c in result.get("citations", [])],
        },
    )
    return result


def record_json(r, user):
    data = r.data
    if r.kind == "network" and user.role == "viewer":
        data = {"provenance": data["provenance"], "analysis": network_analysis(data["edges"], True)}
    return {
        "id": r.id,
        "kind": r.kind,
        "dataset_id": r.dataset_id,
        "owner": r.owner,
        "status": r.status,
        "version": r.version,
        "data": data,
        "created_at": r.created_at.isoformat(),
    }


@app.get("/api/records/{kind}")
def list_records(
    kind: str, dataset_id: str | None = None, user=Depends(current_user), db=Depends(get_db)
):
    if kind not in KINDS:
        raise HTTPException(404, "Unknown module")
    if kind in {"source", "attempt", "brief_schedule"} and user.role not in {
        "supervisor",
        "administrator",
    }:
        raise HTTPException(403, "Supervisor required")
    return [
        record_json(r, user)
        for r in records(
            db,
            kind,
            dataset_id,
            user.id if kind in {"notification", "subscription", "view"} else None,
        )
    ]


@app.post("/api/records/{kind}")
def create_record(kind: str, body: RecordCreate, user=Depends(current_user), db=Depends(get_db)):
    if user.role == "viewer" and kind != "subscription":
        raise HTTPException(403, "Analyst required")
    if kind not in KINDS - {"notification", "attempt", "model", "brief"}:
        raise ValueError("Module cannot be created through this endpoint")
    if kind in {"source", "brief_schedule"} and user.role not in {"supervisor", "administrator"}:
        raise HTTPException(403, "Supervisor required")
    if not body.dataset_id and kind not in {"subscription", "source"}:
        raise ValueError("Dataset is required")
    if body.dataset_id:
        dataset(db, body.dataset_id)
    data = dict(body.data)
    if len(canonical(data)) > settings().max_upload_bytes:
        raise HTTPException(413, "Module data exceeds maximum size")
    if kind == "network":
        validate_edges(data)
    elif kind == "context":
        data["analysis"] = context_analysis(incident_rows(db, body.dataset_id), data)
    elif kind == "investigation":
        for field in ("title", "summary", "scope", "limitations", "hypotheses"):
            if not data.get(field):
                raise ValueError(f"Investigation requires {field}")
        for ref in data.get("evidence_refs", []):
            valid_evidence(db, ref, body.dataset_id)
        if not data.get("evidence_refs"):
            raise ValueError("Investigation requires evidence references")
    elif kind == "task":
        if not data.get("title") or not data.get("task_type"):
            raise ValueError("Task requires title and type")
        valid_evidence(db, data.get("evidence_ref"), body.dataset_id)
        data = task_defaults(data)
    elif kind == "warning_review":
        candidates = {
            w["id"]
            for level in ["sensitive", "standard", "conservative"]
            for w in warnings(incident_rows(db, body.dataset_id), level)
        }
        if data.get("warning_id") not in candidates:
            raise ValueError("Unknown warning reference")
    elif kind == "subscription":
        if data.get("minimum_priority", "low") not in {"low", "medium", "high", "critical"}:
            raise ValueError("Invalid minimum priority")
        for existing in records(db, "subscription", owner=user.id):
            if existing.dataset_id == body.dataset_id and existing.data == data:
                return record_json(existing, user)
        allowed = {"assignment", "escalation", "sla", "warning_change", "brief_completion"}
        if not data.get("events") or not set(data["events"]).issubset(allowed):
            raise ValueError("Invalid subscription events")
    elif kind in {"source", "brief_schedule"}:
        interval = int(data.get("interval_hours", 24))
        if not 1 <= interval <= 8760:
            raise ValueError("Schedule interval must be 1–8760 hours")
        from .schemas import Scope

        if kind == "brief_schedule":
            data["scope"] = Scope.model_validate(data.get("scope", {})).model_dump()
        data.update(
            interval_hours=interval,
            next_run=now().isoformat(),
            enabled=bool(data.get("enabled", False)),
        )
        if kind == "source":
            for field in ("code", "name", "station_code", "district_code", "expected_schema"):
                if not data.get(field):
                    raise ValueError(f"Source requires {field}")
            data["max_retries"] = min(3, max(0, int(data.get("max_retries", 2))))
    elif kind == "view" and not data.get("title"):
        raise ValueError("Saved view requires title")
    return record_json(create(db, user, kind, body.dataset_id, data), user)


@app.patch("/api/records/{key}")
def update_record(key: str, body: RecordPatch, user=Depends(current_user), db=Depends(get_db)):
    # Write serialization plus version checking protects claims and approvals.
    db.execute(update(Record).where(Record.id == key).values(version=Record.version))
    item = db.scalar(select(Record).where(Record.id == key).with_for_update())
    if not item:
        raise HTTPException(404, "Record not found")
    if item.kind != "notification" and user.role == "viewer":
        raise HTTPException(403, "Analyst required")
    return record_json(patch(db, user, item, body.action, body.data, body.version), user)


@app.post("/api/notifications/read-all")
def read_all(user=Depends(current_user), db=Depends(get_db)):
    count = 0
    for item in records(db, "notification", owner=user.id):
        if item.status == "unread":
            patch(db, user, item, "read", {}, item.version)
            count += 1
    return {"updated": count}


@app.post("/api/datasets/{key}/models/train")
def train(key: str, user=Depends(require("analyst")), db=Depends(get_db)):
    result = train_model(incident_rows(db, key))
    result["dataset_checksum"] = dataset(db, key).checksum
    result["registry_version"] = len(records(db, "model", key)) + 1
    return record_json(create(db, user, "model", key, result, result["validation_status"]), user)


@app.post("/api/models/{key}/activate")
def activate(key: str, user=Depends(require("supervisor")), db=Depends(get_db)):
    db.execute(update(Record).where(Record.id == key).values(version=Record.version))
    item = db.get(Record, key)
    if not item or item.kind != "model":
        raise HTTPException(404, "Model not found")
    if item.data.get("validation_status") != "validated":
        raise HTTPException(409, "Only holdout-validated models can be activated")
    for previous in records(db, "model", item.dataset_id):
        if previous.status == "active":
            previous.status = "validated"
    item.status = "active"
    item.version += 1
    log(db, user, "model:activate", item.id)
    return record_json(item, user)


@app.post("/api/datasets/{key}/briefs")
def brief(key: str, scope: dict, user=Depends(require("analyst")), db=Depends(get_db)):
    from .schemas import Scope

    clean = Scope.model_validate(scope).model_dump()
    item = create(
        db,
        user,
        "brief",
        key,
        make_brief(dataset(db, key), incident_rows(db, key, **clean), clean),
        "complete",
    )
    notify(db, "brief_completion", item)
    return record_json(item, user)


@app.post("/api/briefs/verify")
def integrity(body: dict, user=Depends(current_user)):
    return verify_brief(body)


@app.get("/api/briefs/{key}/download")
def download_brief(key: str, user=Depends(current_user), db=Depends(get_db)):
    item = db.get(Record, key)
    if not item or item.kind != "brief":
        raise HTTPException(404, "Brief not found")
    log(db, user, "brief:download", key)
    return Response(
        canonical(item.data),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="crimestack-brief-{key}.json"'},
    )


@app.post("/api/sources/{key}/execute")
async def execute_source(
    key: str, file: UploadFile = File(...), user=Depends(require("supervisor")), db=Depends(get_db)
):
    profile = db.get(Record, key)
    if not profile or profile.kind != "source":
        raise HTTPException(404, "Source profile not found")
    if not profile.data.get("enabled"):
        raise HTTPException(409, "Source profile is disabled")
    raw = await upload_bytes(file)
    checksum = hashlib.sha256(raw).hexdigest()
    dedupe_key = f"source:{key}:{checksum}"
    if db.get(Dedupe, dedupe_key):
        raise HTTPException(409, "This checksum has already been ingested for this source")
    failures = [
        r
        for r in records(db, "attempt")
        if r.data.get("source_id") == key
        and r.data.get("checksum") == checksum
        and r.status == "failed"
    ]
    if len(failures) > profile.data["max_retries"]:
        raise HTTPException(409, "Retry budget exhausted for this source and checksum")
    attempt_data = {
        "source_id": key,
        "checksum": checksum,
        "attempt_number": len(failures) + 1,
        "scope": {
            "station": profile.data["station_code"],
            "district": profile.data["district_code"],
        },
    }
    try:
        rows, quality = parse_csv(raw)
        if not set(profile.data["expected_schema"]).issubset(quality["column_mappings"].values()):
            raise ValueError("SCHEMA_MISMATCH")
        if any(
            r.get("station_code") != profile.data["station_code"]
            or r["district_code"] != profile.data["district_code"]
            for r in rows
        ):
            raise ValueError("SCOPE_MISMATCH")
        output = import_data(
            db, user, raw, profile.data["name"] + " import", profile.data["name"], "managed_source"
        )
        attempt = create(
            db,
            user,
            "attempt",
            output.id,
            {**attempt_data, "output_dataset_id": output.id},
            "succeeded",
        )
        db.add(Dedupe(key=dedupe_key, record_id=attempt.id))
    except (ValueError, UnicodeDecodeError) as exc:
        attempt = create(
            db,
            user,
            "attempt",
            profile.dataset_id,
            {
                **attempt_data,
                "failure_code": str(exc)
                if str(exc) in {"SCHEMA_MISMATCH", "SCOPE_MISMATCH"}
                else "CSV_VALIDATION",
                "detail": str(exc),
            },
            "failed",
        )
    return record_json(attempt, user)


@app.get("/api/datasets/{key}/lineage")
def lineage(key: str, user=Depends(require("supervisor")), db=Depends(get_db)):
    d = dataset(db, key)
    attempts = [r for r in records(db, "attempt") if r.data.get("output_dataset_id") == key]
    return {
        "dataset": dataset_json(d),
        "attempts": [record_json(r, user) for r in attempts],
        "sources": [record_json(db.get(Record, r.data["source_id"]), user) for r in attempts],
    }


@app.post("/api/scheduler/tick")
def tick(user=Depends(require("supervisor")), db=Depends(get_db)):
    # Serialize scheduler claims against manual and background ticks.
    from .models import AuditHead

    db.execute(update(AuditHead).where(AuditHead.id == 1).values(sequence=AuditHead.sequence))
    db.scalar(select(AuditHead).where(AuditHead.id == 1).with_for_update())
    results = []
    current = now()
    for schedule in records(db, "brief_schedule") + records(db, "source"):
        config = schedule.data
        if not config.get("enabled") or datetime.fromisoformat(config["next_run"]) > current:
            continue
        dedupe_key = f"schedule:{schedule.id}:{config['next_run']}"
        if db.get(Dedupe, dedupe_key):
            continue
        if schedule.kind == "brief_schedule":
            scope = config.get("scope", {})
            item = create(
                db,
                user,
                "brief",
                schedule.dataset_id,
                make_brief(
                    dataset(db, schedule.dataset_id),
                    incident_rows(db, schedule.dataset_id, **scope),
                    scope,
                ),
                "complete",
            )
            notify(db, "brief_completion", item)
        else:
            item = create(
                db,
                user,
                "attempt",
                schedule.dataset_id,
                {
                    "source_id": schedule.id,
                    "failure_code": "AWAITING_MANUAL_UPLOAD",
                    "scheduled_for": config["next_run"],
                },
                "waiting",
            )
        db.add(Dedupe(key=dedupe_key, record_id=item.id))
        schedule.data = {
            **config,
            "next_run": (current + timedelta(hours=config["interval_hours"])).isoformat(),
        }
        log(db, user, "schedule:execute", schedule.id, {"output": item.id})
        results.append(item.id)
    for task in records(db, "task"):
        if task.status != "done" and datetime.fromisoformat(task.data["due_at"]) < current:
            notify(db, "sla", task, task.data.get("assignee"))
    return {"jobs": results}


@app.get("/api/audit")
def audit(user=Depends(require("supervisor")), db=Depends(get_db)):
    from .models import Audit

    return {
        "verification": verify(db),
        "entries": [
            {"sequence": r.id, **r.payload, "digest": r.digest}
            for r in db.scalars(select(Audit).order_by(Audit.id.desc()).limit(200))
        ],
    }


@app.get("/api/audit/verify")
def audit_verify(user=Depends(require("supervisor")), db=Depends(get_db)):
    return verify(db)
