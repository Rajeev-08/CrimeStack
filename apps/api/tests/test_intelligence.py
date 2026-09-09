import json
from pathlib import Path
import pytest
from crimestack.services.intelligence import (
    validate_edges,
    network_analysis,
    train_model,
    context_analysis,
)
from crimestack.services.ingestion import parse_csv

EXAMPLES = Path(__file__).resolve().parents[3] / "data/examples"


def test_network_masking_patterns(client, dataset):
    data = json.loads((EXAMPLES / "synthetic-network.json").read_text())
    validate_edges(data)
    result = network_analysis(data["edges"])
    assert len(result["components"]) == 1
    assert result["repeat_case_patterns"]
    masked = network_analysis(data["edges"], True)
    assert "fictional-id" not in json.dumps(masked)
    assert "FICTIONAL-CASE" not in json.dumps(masked)
    response = client.post("/api/records/network", json={"dataset_id": dataset["id"], "data": data})
    assert response.status_code == 200, response.text
    from test_api import switch

    switch(client, "viewer")
    assert "fictional-id" not in client.get("/api/records/network").text
    assert "fictional-id" not in client.get(f"/api/datasets/{dataset['id']}/network").text


def test_network_authorization():
    with pytest.raises(ValueError):
        validate_edges({"edges": []})


def test_model_splits_calibration_and_rejection():
    rows, _ = parse_csv((EXAMPLES / "synthetic-long-duration.csv").read_bytes())
    result = train_model(rows)
    assert result["validation_status"] in {"validated", "rejected"}, result
    a, b, c = result["splits"]
    assert a["end"] < b["start"] <= b["end"] < c["start"]
    assert 0 <= result["brier_score"] <= 1 and 0 <= result["baseline_brier"] <= 1
    assert (result["validation_status"] == "validated") == (
        result["brier_score"] < result["baseline_brier"]
    )
    assert all(0 <= s["probability"] <= 1 for s in result["signals"])
    assert "drift" in result
    assert train_model(rows[:10])["validation_status"] == "not_ready"


def test_model_activation_rejected(client, dataset):
    response = client.post(f"/api/datasets/{dataset['id']}/models/train")
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "not_ready"
    assert client.post("/api/models/" + response.json()["id"] + "/activate").status_code == 409


def test_context_reconciliation_correlation():
    data = json.loads((EXAMPLES / "synthetic-context.json").read_text())
    rows, _ = parse_csv((EXAMPLES / "synthetic-karnataka.csv").read_bytes())
    result = context_analysis(rows, data)
    assert len(result["points"]) == 6 and result["correlation"] is not None
    assert all(
        p["rate_per_100000"] == p["incidents"] / p["population"] * 100000 for p in result["points"]
    )
    limited = context_analysis(rows[:3], data)
    assert limited["correlation"] is None
    assert limited["unmatched_indicator_districts"]


def test_context_requires_population_and_unique_values():
    data = json.loads((EXAMPLES / "synthetic-context.json").read_text())
    data["indicators"].append(data["indicators"][0])
    with pytest.raises(ValueError):
        context_analysis([], data)
