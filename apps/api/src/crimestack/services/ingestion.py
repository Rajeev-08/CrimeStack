"""Deterministic CSV parsing. Invalid coordinates are retained as non-map-ready rows."""

import csv
import hashlib
import io
import math
from collections import Counter
from datetime import UTC, datetime

FIELDS = [
    "incident_id",
    "occurred_at",
    "reported_at",
    "category",
    "subcategory",
    "description",
    "severity",
    "status",
    "latitude",
    "longitude",
    "state_code",
    "district_code",
    "station_code",
    "source_dataset_id",
]
ALIASES = {
    "id": "incident_id",
    "case_number": "incident_id",
    "date": "occurred_at",
    "datetime_occ": "occurred_at",
    "primary_type": "category",
    "lat": "latitude",
    "lon": "longitude",
    "lng": "longitude",
    "district": "district_code",
    "police_station": "station_code",
    "beat": "station_code",
}
PROVENANCE = {"uploaded_unverified", "official_declared", "synthetic_demo", "managed_source"}


def timestamp(value):
    value = value.strip()
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC).isoformat()


def coordinate(value, maximum):
    try:
        result = float(value)
        return result if math.isfinite(result) and abs(result) <= maximum else None
    except (ValueError, TypeError):
        return None


def parse_csv(raw):
    if b"\x00" in raw:
        raise ValueError("NUL bytes are not valid CSV text")
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    headers = reader.fieldnames or []
    if len(headers) > 80 or not headers:
        raise ValueError("Expected CSV with between 1 and 80 columns")
    mapping = {h: ALIASES.get(h.strip().lower(), h.strip().lower()) for h in headers}
    canonical = list(mapping.values())
    if len(set(canonical)) != len(canonical):
        raise ValueError("Ambiguous columns map to the same canonical field")
    if not {"occurred_at", "category"}.issubset(canonical):
        raise ValueError("CSV requires an occurrence timestamp and category")
    rows, errors, seen = [], [], set()
    duplicates = total = rejected = map_ready = 0
    missing = Counter({field: 0 for field in FIELDS})
    source_ids = 0
    for number, original in enumerate(reader, 2):
        total += 1
        if total > 100000:
            raise ValueError("CSV exceeds 100,000 rows")
        row = {mapping[k]: (v or "").strip() for k, v in original.items() if k is not None}
        for field in FIELDS:
            if not row.get(field):
                missing[field] += 1
        try:
            if None in original or not row.get("category"):
                raise ValueError("Missing category or inconsistent column count")
            row["occurred_at"] = timestamp(row.get("occurred_at", ""))
            if row.get("reported_at"):
                row["reported_at"] = timestamp(row["reported_at"])
            source_id = row.get("incident_id", "")
            row["category"] = row["category"].strip()
            identity = (
                source_id
                or hashlib.sha256(
                    repr(sorted((k, v) for k, v in row.items() if k != "incident_id")).encode()
                ).hexdigest()
            )
            if identity in seen:
                duplicates += 1
                continue
            seen.add(identity)
            source_ids += bool(source_id)
            row["incident_id"] = identity
            row["latitude"] = coordinate(row.get("latitude"), 90)
            row["longitude"] = coordinate(row.get("longitude"), 180)
            if row["latitude"] is None or row["longitude"] is None:
                row["latitude"] = row["longitude"] = None
            else:
                map_ready += 1
            row["district_code"] = row.get("district_code", "")
            row["severity"] = row.get("severity", "unknown").lower() or "unknown"
            if row["severity"] not in {"low", "medium", "high", "critical", "unknown"}:
                row["severity"] = "unknown"
            rows.append(row)
        except (ValueError, TypeError) as exc:
            rejected += 1
            if len(errors) < 20:
                errors.append({"row": number, "error": str(exc)})
    n = len(rows)
    coverage = {
        "source_id": source_ids / max(n, 1),
        "timestamp": n / max(total, 1),
        "coordinate": map_ready / max(n, 1),
        "district": sum(bool(r["district_code"]) for r in rows) / max(n, 1),
        "station": sum(bool(r.get("station_code")) for r in rows) / max(n, 1),
    }
    quality = {
        "total_rows": total,
        "accepted_rows": n,
        "rejected_rows": rejected,
        "duplicate_rows": duplicates,
        "map_ready_rows": map_ready,
        "quality_score": round(
            100 * (n / max(total, 1) * 0.5 + sum(coverage.values()) / 5 * 0.5), 1
        ),
        "column_mappings": mapping,
        "missing_field_counts": dict(missing),
        "errors": errors,
        "coverage": coverage,
        "duplicate_rate": duplicates / max(total, 1),
        "category_distribution": dict(Counter(r["category"] for r in rows)),
        "district_distribution": dict(Counter(r["district_code"] for r in rows)),
        "date_window": [
            min((r["occurred_at"] for r in rows), default=None),
            max((r["occurred_at"] for r in rows), default=None),
        ],
        "schema_fingerprint": hashlib.sha256(repr(sorted(headers)).encode()).hexdigest(),
        "limitation": "Structural quality is not proof of authenticity. Naive timestamps are interpreted as UTC. Invalid coordinate pairs are excluded from maps.",
    }
    return rows, quality


def drift(a, b, a_ids, b_ids):
    return {
        "schema_changed": a.quality["schema_fingerprint"] != b.quality["schema_fingerprint"],
        "mapping_changes": {
            k: [a.quality["column_mappings"].get(k), b.quality["column_mappings"].get(k)]
            for k in set(a.quality["column_mappings"]) | set(b.quality["column_mappings"])
            if a.quality["column_mappings"].get(k) != b.quality["column_mappings"].get(k)
        },
        "category_shifts": [a.quality["category_distribution"], b.quality["category_distribution"]],
        "district_shifts": [a.quality["district_distribution"], b.quality["district_distribution"]],
        "source_id_overlap": len(set(a_ids) & set(b_ids)),
        "date_windows": [a.quality["date_window"], b.quality["date_window"]],
        "declared_sources": [a.publisher, b.publisher],
        "quality_scores": [a.quality["quality_score"], b.quality["quality_score"]],
    }
