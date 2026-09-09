import hashlib
import json

from sqlalchemy import select, update

from .models import Audit, AuditHead, now


def canonical(value):
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
    )


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def log(db, user, action, target, details=None):
    # A write lock serializes SQLite writers; FOR UPDATE serializes PostgreSQL writers.
    db.execute(update(AuditHead).where(AuditHead.id == 1).values(sequence=AuditHead.sequence))
    head = db.scalar(select(AuditHead).where(AuditHead.id == 1).with_for_update())
    if head is None:
        raise RuntimeError("Run database migrations before starting")
    payload = {
        "actor": user.id if user else "bootstrap",
        "action": action,
        "target": str(target),
        "details": details or {},
        "at": now().isoformat(),
    }
    current = digest({"previous": head.digest, "payload": payload})
    head.sequence += 1
    db.add(Audit(id=head.sequence, payload=payload, previous=head.digest, digest=current))
    head.digest = current
    db.flush()


def verify(db):
    previous = "0" * 64
    count = 0
    for row in db.scalars(select(Audit).order_by(Audit.id)):
        count += 1
        if (
            row.id != count
            or row.previous != previous
            or row.digest != digest({"previous": previous, "payload": row.payload})
        ):
            return {"valid": False, "failed_sequence": row.id}
        previous = row.digest
    head = db.get(AuditHead, 1)
    return {
        "valid": bool(head and head.sequence == count and head.digest == previous),
        "entries": count,
        "head": previous,
    }
