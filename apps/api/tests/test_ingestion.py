import pytest
from crimestack.services.ingestion import parse_csv
from crimestack.services.analytics import metrics, hotspots, warnings


@pytest.mark.parametrize(
    "lat,lon,expected",
    [
        ("0", "0", 1),
        ("90", "180", 1),
        ("91", "20", 0),
        ("20", "181", 0),
        ("nan", "20", 0),
        ("inf", "20", 0),
        ("bad", "20", 0),
        ("", "", 0),
        ("-90", "-180", 1),
    ],
)
def test_coordinates(lat, lon, expected):
    rows, q = parse_csv(f"date,primary_type,lat,lng\n2026-01-01,Theft,{lat},{lon}\n".encode())
    assert q["map_ready_rows"] == expected
    assert len(rows) == 1


def test_aliases_duplicates_and_errors():
    rows, q = parse_csv(
        b"case_number,datetime_occ,primary_type,beat\nA,2026-01-01,Theft,S1\nA,2026-01-01,Theft,S1\nB,invalid,Theft,S2\nC,2026-01-02,,S2\n"
    )
    assert q["accepted_rows"] == 1 and q["rejected_rows"] == 2 and q["duplicate_rows"] == 1
    assert rows[0]["station_code"] == "S1"
    assert q["column_mappings"]["case_number"] == "incident_id"


@pytest.mark.parametrize(
    "raw", [b"a,b\n1,2", b"date,occurred_at,category\n1,2,3", b"date,category\n\x00,x"]
)
def test_invalid_schema(raw):
    with pytest.raises(ValueError):
        parse_csv(raw)


def test_generated_ids_are_stable():
    raw = b"date,category\n2026-01-01,Theft\n2026-01-01,Theft\n"
    rows, q = parse_csv(raw)
    assert len(rows) == 1 and q["duplicate_rows"] == 1
    assert rows == parse_csv(raw)[0]
    assert q["coverage"]["source_id"] == 0


def test_zero_and_statistics():
    assert metrics([])["total"] == 0
    rows, _ = parse_csv(
        b"date,category,severity,district\n2026-01-01,Theft,high,A\n2026-01-02,Fraud,low,B\n"
    )
    result = metrics(rows)
    assert (
        result["total"] == 2 and result["high_severity"] == 1 and result["district_coverage"] == 2
    )


def test_connected_hotspots():
    rows = [{"latitude": 12.001, "longitude": 77.001, "incident_id": str(i)} for i in range(3)] + [
        {"latitude": 12.001, "longitude": 77.021, "incident_id": str(i + 3)} for i in range(3)
    ]
    result = hotspots(rows)
    assert len(result["groups"]) == 1 and result["groups"][0]["count"] == 6
    assert result == hotspots(list(reversed(rows)))


def test_warning_calculation():
    rows = []
    for day, count in [
        ("2026-01-05", 2),
        ("2026-01-12", 2),
        ("2026-01-19", 2),
        ("2026-01-26", 2),
        ("2026-02-02", 8),
    ]:
        rows.extend(
            {"occurred_at": day, "severity": "high", "district_code": "A", "category": "Theft"}
            for _ in range(count)
        )
    result = warnings(rows)[0]
    assert (
        result["baseline"] == 2 and result["latest"] == 8 and result["percentage_increase"] == 300
    )
    assert result["severity_weight"] == 1.5
    assert len(warnings(rows[:2])) == 0
