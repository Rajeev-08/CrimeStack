import json
from pathlib import Path

import pytest

from crimestack.services.ingestion import parse_csv
from crimestack.services.patterns import discover
from crimestack.services.intelligence import network_analysis, validate_edges

EXAMPLES = Path(__file__).resolve().parents[3] / "data/examples"


def test_pattern_totals_filters_and_time_distributions(client, dataset):
    result = client.get(f"/api/datasets/{dataset['id']}/patterns?district=Bengaluru").json()
    assert result["total_incidents"] == 3
    assert sum(result["hourly"].values()) == 3
    assert sum(result["weekdays"].values()) == 3
    assert sum(s["count"] for s in result["time_matrix"]) == 3
    assert len(result["segments"]) == 1
    assert result["segments"][0]["category"] == "Theft"
    assert result["ml"]["status"] == "not_ready"
    assert result["evidence_ref"] == "dataset:" + dataset["id"]


def test_ml_pattern_reproducibility_and_no_person_features():
    rows, _ = parse_csv((EXAMPLES / "synthetic-long-duration.csv").read_bytes())
    result = discover(rows)
    assert result["ml"]["status"] == "ready"
    assert result["ml"]["total_anomalies"] > 0
    assert len(result["ml"]["anomalies"]) <= 25
    assert result["ml"] == discover(list(reversed(rows)))["ml"]
    assert all(
        "district" in cell and "category" in cell and "entity_id" not in cell
        for cell in result["ml"]["anomalies"]
    )


@pytest.mark.parametrize(
    "question,tool",
    [
        ("Discover crime patterns", "patterns"),
        ("Show repeat offender case history", "repeat_cases"),
        ("Socio-economic correlation", "context"),
        ("What prevention review actions are supported?", "prevention"),
        ("ವಾರದ ದಿನ ಮಾದರಿಗಳ ಅನ್ವೇಷಣೆ", "patterns"),
        ("ಪುನರಾವರ್ತಿತ ಪ್ರಕರಣ ಇತಿಹಾಸ", "repeat_cases"),
        ("ಸಾಮಾಜಿಕ ಸೂಚಕಗಳು", "context"),
    ],
)
def test_new_copilot_tools_are_cited(client, dataset, question, tool):
    result = client.post(
        f"/api/datasets/{dataset['id']}/copilot", json={"question": question}
    ).json()
    assert result["tool"] == tool
    assert result["citations"][0]["evidence_ref"] == "dataset:" + dataset["id"]


def test_natural_calendar_scope_and_followup(client, dataset):
    path = f"/api/datasets/{dataset['id']}/copilot"
    result = client.post(path, json={"question": "Show theft in Bengaluru in January 2026"}).json()
    assert result["result"] == 2
    assert result["context"]["start"] == "2026-01-01"
    assert result["context"]["end"] == "2026-01-31"
    followup = client.post(
        path, json={"question": "What about Mysuru?", "context": result["context"]}
    ).json()
    assert followup["citations"][0]["matched_rows"] == 0
    assert followup["context"]["category"] == "Theft"
    assert followup["context"]["start"] == "2026-01-01"


@pytest.mark.parametrize(
    "scope", [{"start": "2026-02-30"}, {"start": "2026-03-01", "end": "2026-01-01"}]
)
def test_invalid_dates_rejected(client, dataset, scope):
    response = client.post(
        f"/api/datasets/{dataset['id']}/copilot", json={"question": "Show totals", "context": scope}
    )
    assert response.status_code == 422


def test_network_history_and_auxiliary_citations(client, dataset):
    data = json.loads((EXAMPLES / "synthetic-network.json").read_text())
    data["edges"][0]["date"] = "2026-01-01"
    data["edges"][1]["date"] = "2026-01-08"
    imported = client.post(
        "/api/records/network", json={"dataset_id": dataset["id"], "data": data}
    ).json()
    result = client.post(
        f"/api/datasets/{dataset['id']}/copilot", json={"question": "Show repeat cases"}
    ).json()
    assert any(c["evidence_ref"] == "record:" + imported["id"] for c in result["citations"])
    assert result["result"]["entities"]
    assert any(node["case_history"] for node in result["result"]["entities"])
    masked = network_analysis(data["edges"], mask=True)
    assert "FICTIONAL-CASE" not in json.dumps(masked)
    assert all(
        case["case_reference"] == "Masked"
        for node in masked["nodes"]
        for case in node["case_history"]
    )


def test_context_copilot_uses_imported_indicators_and_cites_record(client, dataset):
    data = json.loads((EXAMPLES / "synthetic-context.json").read_text())
    imported = client.post("/api/records/context", json={"dataset_id": dataset["id"], "data": data})
    assert imported.status_code == 200, imported.text
    result = client.post(
        f"/api/datasets/{dataset['id']}/copilot", json={"question": "Show population correlation"}
    ).json()
    assert result["result"][0]["source_name"] == data["source_name"]
    assert len(result["result"][0]["points"]) == 2
    assert result["result"][0]["correlation"] is None
    assert any(c["evidence_ref"] == "record:" + imported.json()["id"] for c in result["citations"])


def test_date_validation_for_case_history():
    data = json.loads((EXAMPLES / "synthetic-network.json").read_text())
    data["edges"][0]["date"] = "not-a-date"
    with pytest.raises(ValueError):
        validate_edges(data)


def test_empty_patterns_and_safe_review_actions():
    result = discover([])
    assert result["total_incidents"] == 0 and result["review_actions"] == []
    assert result["ml"]["status"] == "not_ready"


@pytest.mark.parametrize(
    "question",
    [
        "Count incidents on 2026-02-30",
        "Show totals from 2026-03-01 to 2026-01-01",
        "Show totals in January 0000",
    ],
)
def test_invalid_question_dates_return_validation_error(client, dataset, question):
    response = client.post(f"/api/datasets/{dataset['id']}/copilot", json={"question": question})
    assert response.status_code == 422
    assert "calendar" in response.json()["detail"]


def test_followup_retains_analysis_and_can_reset_dates(client, dataset):
    path = f"/api/datasets/{dataset['id']}/copilot"
    first = client.post(
        path, json={"question": "Show severity in Bengaluru in January 2026"}
    ).json()
    second = client.post(
        path,
        json={
            "question": "What about Mysuru?",
            "context": first["context"],
            "previous_tool": first["previous_tool"],
        },
    ).json()
    assert second["tool"] == "severity"
    assert second["context"]["district"] == "Mysuru"
    reset = client.post(
        path,
        json={
            "question": "all dates",
            "context": second["context"],
            "previous_tool": second["previous_tool"],
        },
    ).json()
    assert reset["tool"] == "severity"
    assert reset["context"]["start"] is None
    assert reset["result"] == {"medium": 1}


def test_capability_status_requires_login_and_never_claims_live_provider(client, admin):
    result = client.get("/api/copilot/capabilities")
    assert result.status_code == 200
    assert result.json()["provider_verified"] is False
    assert "llm_api_key" not in result.text
    client.headers.pop("Authorization")
    assert client.get("/api/copilot/capabilities").status_code == 401
