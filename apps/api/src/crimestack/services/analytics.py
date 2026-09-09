import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta


def metrics(rows):
    return {
        "total": len(rows),
        "high_severity": sum(r["severity"] in {"high", "critical"} for r in rows),
        "district_coverage": len({r["district_code"] for r in rows if r["district_code"]}),
        "map_ready": sum(r["latitude"] is not None and r["longitude"] is not None for r in rows),
        "monthly": dict(sorted(Counter(r["occurred_at"][:7] for r in rows).items())),
        "categories": dict(Counter(r["category"] for r in rows).most_common()),
        "districts": dict(Counter(r["district_code"] or "Unspecified" for r in rows).most_common()),
        "severity": dict(Counter(r["severity"] for r in rows)),
    }


def hotspots(rows, cell_degrees=0.02, minimum=3):
    cells = defaultdict(list)
    for r in rows:
        if r["latitude"] is not None and r["longitude"] is not None:
            cells[
                (
                    math.floor(r["longitude"] / cell_degrees),
                    math.floor(r["latitude"] / cell_degrees),
                )
            ].append(r["incident_id"])
    dense = {key for key, values in cells.items() if len(values) >= minimum}
    groups = []
    while dense:
        stack = [min(dense)]
        dense.remove(stack[0])
        connected = []
        while stack:
            x, y = stack.pop()
            connected.append((x, y))
            for neighbor in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if neighbor in dense:
                    dense.remove(neighbor)
                    stack.append(neighbor)
        groups.append(
            {
                "id": f"hotspot-{len(groups) + 1}",
                "count": sum(len(cells[c]) for c in connected),
                "cells": [
                    {
                        "west": x * cell_degrees,
                        "south": y * cell_degrees,
                        "east": (x + 1) * cell_degrees,
                        "north": (y + 1) * cell_degrees,
                    }
                    for x, y in sorted(connected)
                ],
            }
        )
    return {
        "groups": groups,
        "cell_degrees": cell_degrees,
        "minimum": minimum,
        "method": "Four-neighbor connected fixed density cells; grid aligned to 0 degrees.",
        "limitation": "Historical density, not future crime prediction. Angular cell area varies by latitude.",
    }


def week(value):
    d = datetime.fromisoformat(value).date()
    return d - timedelta(days=d.weekday())


def warnings(rows, threshold="standard"):
    if not rows:
        return []
    factor = {"sensitive": 1.3, "standard": 1.8, "conservative": 2.5}[threshold]
    end = max(week(r["occurred_at"]) for r in rows)
    start = min(week(r["occurred_at"]) for r in rows)
    if (end - start).days < 28:
        return []
    groups = defaultdict(list)
    for r in rows:
        groups[("statewide", "All")].append(r)
        groups[("district", r["district_code"] or "Unspecified")].append(r)
        groups[("category", r["category"])].append(r)
    result = []
    for (dimension, name), items in sorted(groups.items()):
        counts = Counter(week(r["occurred_at"]) for r in items)
        base_counts = [counts[end - timedelta(weeks=i)] for i in range(1, 5)]
        baseline = sum(base_counts) / 4
        latest = counts[end]
        if latest < 3 or latest < max(1, baseline) * factor:
            continue
        weight = (
            sum(
                {"critical": 2, "high": 1.5}.get(r["severity"], 1)
                for r in items
                if week(r["occurred_at"]) == end
            )
            / latest
        )
        result.append(
            {
                "id": f"{end}:{dimension}:{name}:{threshold}",
                "dimension": dimension,
                "name": name,
                "week": str(end),
                "latest": latest,
                "baseline": baseline,
                "baseline_counts": base_counts,
                "percentage_increase": round((latest - baseline) / baseline * 100, 1)
                if baseline
                else None,
                "anomaly_score": round(
                    (latest - baseline) / math.sqrt(max(1, baseline)) * weight, 2
                ),
                "severity_weight": round(weight, 2),
                "confidence": "moderate" if baseline >= 5 else "low",
                "threshold": factor,
                "limitation": "Latest observed week may be incomplete; reporting changes can explain increases. Zero baseline has no defined percentage increase.",
            }
        )
    return result
