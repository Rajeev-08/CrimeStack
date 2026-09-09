from datetime import datetime, timedelta, timezone
import jwt
import pytest
from sqlalchemy import select
from crimestack.models import Audit
from crimestack.audit import verify
from crimestack.config import settings, Settings


def switch(client, role):
    response = client.post(
        "/api/users",
        json={"email": role + "@example.test", "password": "Testing-password-2026", "role": role},
    )
    assert response.status_code == 200, response.text
    response = client.post(
        "/api/auth/login",
        json={"email": role + "@example.test", "password": "Testing-password-2026"},
    )
    client.headers["Authorization"] = "Bearer " + response.json()["access_token"]
    return response.json()["user"]


def test_bootstrap_and_auth(client, admin):
    assert client.get("/api/auth/status").json()["bootstrap_required"] is False
    assert (
        client.post(
            "/api/auth/bootstrap",
            json={
                "email": "x@y.z",
                "password": "Testing-password-2026",
                "bootstrap_secret": "local-bootstrap-change-me",
            },
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/auth/login", json={"email": admin["email"], "password": "wrong-password-123"}
        ).status_code
        == 401
    )
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/ready").status_code == 503
    assert client.get("/api/audit/verify").json()["valid"]


def test_expired_token(client, admin):
    expired = jwt.encode(
        {
            "sub": admin["id"],
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
            "iat": datetime.now(timezone.utc) - timedelta(minutes=1),
            "iss": "crimestack",
            "aud": "crimestack-web",
        },
        settings().token_secret,
        algorithm="HS256",
    )
    client.headers["Authorization"] = "Bearer " + expired
    assert client.get("/api/datasets").status_code == 401


def test_viewer_permissions(client, dataset):
    switch(client, "viewer")
    assert client.get("/api/datasets").status_code == 200
    assert client.get("/api/audit").status_code == 403
    assert (
        client.post(
            "/api/datasets/preview", files={"file": ("x.csv", b"date,category\n2026-01-01,Theft")}
        ).status_code
        == 403
    )
    assert (
        client.post("/api/records/task", json={"dataset_id": dataset["id"], "data": {}}).status_code
        == 403
    )


def test_provenance_preview_analytics(client, dataset):
    key = dataset["id"]
    assert dataset["provenance"] == "synthetic_demo"
    assert client.get("/api/datasets").json()[0]["provenance"] == "synthetic_demo"
    result = client.get(f"/api/datasets/{key}/analytics").json()
    assert result["metrics"]["total"] == 4 and len(result["points"]) == 3
    assert len(result["hotspots"]["groups"]) == 1
    assert (
        client.get(f"/api/datasets/{key}/analytics?district=Bengaluru&category=Fraud").json()[
            "metrics"
        ]["total"]
        == 0
    )
    assert (
        client.get(f"/api/datasets/{key}/analytics?start=2026-02-02&end=2026-02-02").json()[
            "metrics"
        ]["total"]
        == 2
    )
    assert client.get(f"/api/datasets/{key}/compare/{key}").json()["source_id_overlap"] == 4


@pytest.mark.parametrize(
    "question,tool",
    [
        ("How many incidents?", "totals"),
        ("Show severity", "severity"),
        ("Show districts", "districts"),
        ("Show categories", "categories"),
        ("Monthly trend", "trends"),
        ("Show hotspots", "hotspots"),
        ("Show warnings", "warnings"),
        ("Show network", "network"),
        ("Show models", "models"),
        ("ಒಟ್ಟು ಎಷ್ಟು ಘಟನೆಗಳು", "totals"),
    ],
)
def test_copilot_intents(client, dataset, question, tool):
    response = client.post(
        f"/api/datasets/{dataset['id']}/copilot",
        json={"question": question, "language": "kn" if "ಒಟ್ಟು" in question else "en"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["citations"][0]["tool"] == tool
    assert response.json()["mode"] == "Rules-based evidence mode"


def test_copilot_context_zero_unsupported_and_refusal(client, dataset):
    path = f"/api/datasets/{dataset['id']}/copilot"
    result = client.post(
        path, json={"question": "What about Fraud?", "context": {"district": "Bengaluru"}}
    ).json()
    assert result["context"]["district"] == "Bengaluru" and result["context"]["category"] == "Fraud"
    assert result["citations"][0]["matched_rows"] == 0 and "0 incidents" in result["answer"]
    assert client.post(path, json={"question": "Recommend an arrest"}).json()["refused"]
    assert client.post(path, json={"question": "Write a poem"}).status_code == 422


def test_provider_adapter_mock(client, dataset, monkeypatch):
    import crimestack.services.copilot as c

    config = settings()
    monkeypatch.setattr(config, "llm_api_key", "test-key")
    monkeypatch.setattr(config, "llm_model", "test-model")

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"message": {"content": '{"tool":"totals","scope":{}}'}}]}

    monkeypatch.setattr(c.httpx, "post", lambda *a, **kw: Response())
    result = client.post(
        f"/api/datasets/{dataset['id']}/copilot", json={"question": "Count records"}
    ).json()
    assert result["result"] == 4 and result["mode"] == "AI tool-routing mode"
    monkeypatch.setattr(
        Response,
        "json",
        lambda s: {
            "choices": [{"message": {"content": '{"tool":"execute_sql","sql":"DROP TABLE users"}'}}]
        },
    )
    assert (
        client.post(
            f"/api/datasets/{dataset['id']}/copilot", json={"question": "Count records"}
        ).status_code
        == 502
    )


def test_investigation_lifecycle(client, dataset):
    response = client.post(
        "/api/records/investigation",
        json={
            "dataset_id": dataset["id"],
            "data": {
                "title": "Review",
                "summary": "Test",
                "scope": "District aggregates",
                "limitations": "Fictional",
                "hypotheses": "Reporting changed",
                "evidence_refs": ["dataset:" + dataset["id"]],
            },
        },
    )
    assert response.status_code == 200, response.text
    item = response.json()
    for action, data in [
        ("note", {"text": "A note"}),
        ("verification", {"text": "Review source"}),
        ("submit", {}),
        ("approve", {}),
    ]:
        response = client.patch(
            "/api/records/" + item["id"],
            json={"version": item["version"], "action": action, "data": data},
        )
        assert response.status_code == 200, response.text
        item = response.json()
    assert item["status"] == "approved" and len(item["data"]["snapshot_sha256"]) == 64
    assert (
        client.patch(
            "/api/records/" + item["id"],
            json={"version": item["version"], "action": "note", "data": {"text": "Edit"}},
        ).status_code
        == 409
    )


def test_tasks_notifications_and_concurrency(client, dataset):
    client.post(
        "/api/records/subscription",
        json={
            "dataset_id": dataset["id"],
            "data": {"events": ["assignment", "escalation", "sla"], "minimum_priority": "low"},
        },
    )
    item = client.post(
        "/api/records/task",
        json={
            "dataset_id": dataset["id"],
            "data": {
                "title": "Review warning",
                "task_type": "verification",
                "priority": "high",
                "evidence_ref": "dataset:" + dataset["id"],
            },
        },
    ).json()
    result = client.patch("/api/records/" + item["id"], json={"version": 1, "action": "claim"})
    assert result.status_code == 200, result.text
    assert (
        client.patch(
            "/api/records/" + item["id"], json={"version": 1, "action": "claim"}
        ).status_code
        == 409
    )
    notices = client.get("/api/records/notification").json()
    assert len(notices) == 1
    assert client.post("/api/notifications/read-all").json()["updated"] == 1
    assert client.post("/api/notifications/read-all").json()["updated"] == 0
    assert client.get("/api/records/notification").json()[0]["status"] == "read"


def test_brief_integrity_and_scheduling(client, dataset):
    result = client.post(f"/api/datasets/{dataset['id']}/briefs", json={})
    assert result.status_code == 200, result.text
    brief = result.json()
    assert client.post("/api/briefs/verify", json=brief["data"]).json()["valid"]
    assert client.get("/api/briefs/" + brief["id"] + "/download").json() == brief["data"]
    brief["data"]["artifact"]["metrics"]["total"] = 900
    assert not client.post("/api/briefs/verify", json=brief["data"]).json()["valid"]
    client.post(
        "/api/records/brief_schedule",
        json={"dataset_id": dataset["id"], "data": {"interval_hours": 24, "enabled": True}},
    )
    assert len(client.post("/api/scheduler/tick").json()["jobs"]) == 1
    assert len(client.post("/api/scheduler/tick").json()["jobs"]) == 0


def test_source_retries_lineage(client, dataset):
    profile = client.post(
        "/api/records/source",
        json={
            "dataset_id": dataset["id"],
            "data": {
                "code": "S1",
                "name": "Controlled source",
                "station_code": "S1",
                "district_code": "A",
                "expected_schema": ["occurred_at", "category"],
                "enabled": True,
                "max_retries": 1,
            },
        },
    ).json()
    path = "/api/sources/" + profile["id"] + "/execute"
    for _ in range(2):
        result = client.post(
            path, files={"file": ("bad.csv", b"date,category,district,beat\n2026-01-01,Theft,B,S1")}
        )
        assert result.json()["status"] == "failed"
    assert (
        client.post(
            path, files={"file": ("bad.csv", b"date,category,district,beat\n2026-01-01,Theft,B,S1")}
        ).status_code
        == 409
    )
    raw = b"date,category,district,beat\n2026-01-01,Theft,A,S1"
    success = client.post(path, files={"file": ("good.csv", raw)}).json()
    assert success["status"] == "succeeded"
    assert client.post(path, files={"file": ("good.csv", raw)}).status_code == 409
    lineage = client.get(
        "/api/datasets/" + success["data"]["output_dataset_id"] + "/lineage"
    ).json()
    assert lineage["dataset"]["provenance"] == "managed_source" and len(lineage["sources"]) == 1


def test_audit_detects_tamper(client, admin):
    with client.factory() as db:
        assert verify(db)["valid"]
        row = db.scalar(select(Audit))
        row.payload = {**row.payload, "action": "tampered"}
        db.commit()
        assert not verify(db)["valid"]


def test_production_configuration():
    with pytest.raises(ValueError):
        Settings(environment="production")


def test_private_subscriptions_and_notification_dedupe(client, dataset):
    body = {
        "dataset_id": dataset["id"],
        "data": {"events": ["brief_completion"], "minimum_priority": "low"},
    }
    first = client.post("/api/records/subscription", json=body).json()
    second = client.post("/api/records/subscription", json=body).json()
    assert first["id"] == second["id"]
    client.post(f"/api/datasets/{dataset['id']}/briefs", json={})
    assert len(client.get("/api/records/notification").json()) == 1
    switch(client, "viewer")
    assert client.get("/api/records/notification").json() == []
    assert client.post("/api/records/subscription", json=body).status_code == 200
    assert client.get("/api/records/subscription").json()[0]["id"] != first["id"]


def test_kannada_context_aliases(client, dataset):
    result = client.post(
        f"/api/datasets/{dataset['id']}/copilot",
        json={"question": "ಬೆಂಗಳೂರು ಕಳ್ಳತನ ಎಷ್ಟು", "language": "kn"},
    ).json()
    assert result["context"]["district"] == "Bengaluru"
    assert result["context"]["category"] == "Theft"
    assert result["citations"][0]["matched_rows"] == 3
