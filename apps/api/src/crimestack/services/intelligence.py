import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta

import numpy as np
from scipy.stats import spearmanr
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss

from .analytics import week


def network_analysis(edges, mask=False):
    adjacency = defaultdict(set)
    cases = defaultdict(set)
    aliases = {}
    for edge in edges:
        a, b = edge["source"], edge["target"]
        adjacency[a].add(b)
        adjacency[b].add(a)
        cases[a].add(edge["case_reference"])
        cases[b].add(edge["case_reference"])
        aliases[a] = edge["source_alias"]
        aliases[b] = edge["target_alias"]
    unseen = set(adjacency)
    components = []
    while unseen:
        todo = [min(unseen)]
        unseen.remove(todo[0])
        component = []
        while todo:
            node = todo.pop()
            component.append(node)
            for neighbor in sorted(adjacency[node] & unseen):
                unseen.remove(neighbor)
                todo.append(neighbor)
        components.append(sorted(component))

    # Mask stable raw identifiers and case references for viewers; use declared aliases.
    def label(key):
        return aliases[key] if mask else key

    return {
        "nodes": [
            {
                "id": label(n),
                "alias": aliases[n],
                "connections": len(adjacency[n]),
                "case_count": len(cases[n]),
                "entity_type": next(
                    e["source_type"] if e["source"] == n else e["target_type"]
                    for e in edges
                    if n in {e["source"], e["target"]}
                ),
                "case_history": [
                    {
                        "case_reference": "Masked" if mask else case,
                        "dates": sorted(
                            {
                                e["date"]
                                for e in edges
                                if e.get("date")
                                and e["case_reference"] == case
                                and n in {e["source"], e["target"]}
                            }
                        ),
                        "relationship_types": sorted(
                            {
                                e["relationship_type"]
                                for e in edges
                                if e["case_reference"] == case and n in {e["source"], e["target"]}
                            }
                        ),
                    }
                    for case in sorted(cases[n])
                ],
            }
            for n in sorted(adjacency)
        ],
        "edges": [
            {
                **{k: v for k, v in e.items() if k not in {"case_reference", "source", "target"}},
                "source": label(e["source"]),
                "target": label(e["target"]),
                "case_reference": "Masked" if mask else e["case_reference"],
            }
            for e in edges
        ],
        "components": [[label(n) for n in c] for c in components],
        "repeat_case_patterns": [
            {"entity": label(n), "case_count": len(cases[n])}
            for n in sorted(cases)
            if len(cases[n]) > 1
        ],
        "limitation": "Declared relationships are not proof of guilt or criminal affiliation.",
    }


def validate_edges(data):
    if (
        not data.get("confirmed")
        or not data.get("authorization_basis")
        or data.get("provenance")
        not in {"synthetic_demo", "uploaded_unverified", "official_declared"}
    ):
        raise ValueError("Confirm synthetic or authorized data, provenance and authorization basis")
    edges = data.get("edges", [])
    if not edges or len(edges) > 10000:
        raise ValueError("Provide 1–10,000 relationship records")
    aliases = {}
    for edge in edges:
        for field in (
            "source",
            "target",
            "source_alias",
            "target_alias",
            "source_type",
            "target_type",
            "relationship_type",
            "case_reference",
        ):
            if not isinstance(edge.get(field), str) or not edge[field].strip():
                raise ValueError(f"Relationship requires {field}")
        for side in ("source", "target"):
            key, alias = edge[side], edge[side + "_alias"]
            if key in aliases and aliases[key] != alias:
                raise ValueError("Each entity must have a stable alias")
            aliases[key] = alias
        if edge.get("date"):
            datetime.fromisoformat(edge["date"])
        if "confidence" in edge and not 0 <= float(edge["confidence"]) <= 1:
            raise ValueError("Confidence must be 0–1")
    if len(set(aliases.values())) != len(aliases):
        raise ValueError("Aliases must be unique across entities")


def train_model(rows):
    if not rows:
        return {"validation_status": "not_ready", "reason": "No incidents"}
    first, last = (
        min(week(r["occurred_at"]) for r in rows),
        max(week(r["occurred_at"]) for r in rows),
    )
    weeks = [first + timedelta(weeks=i) for i in range((last - first).days // 7 + 1)]
    # Exclude first and last observed weeks because their coverage may be partial.
    weeks = weeks[1:-1]
    if len(weeks) < 40:
        return {
            "validation_status": "not_ready",
            "reason": "Requires at least 42 observed weeks (40 complete interior weeks)",
        }
    groups = defaultdict(Counter)
    for r in rows:
        groups[(r["district_code"], r["category"])][week(r["occurred_at"])] += 1
    train_end, calibration_end = int(len(weeks) * 0.6), int(len(weeks) * 0.8)
    samples = []
    for key, counts in sorted(groups.items()):
        for i in range(4, len(weeks)):
            recent = [counts[weeks[j]] for j in range(i - 4, i)]
            mean = sum(recent) / 4
            samples.append(
                (
                    i,
                    key,
                    [recent[-1], mean, recent[-1] - mean],
                    int(counts[weeks[i]] > max(2, mean * 1.5)),
                )
            )
    chunks = [
        [s for s in samples if low <= s[0] < high]
        for low, high in [
            (4, train_end),
            (train_end, calibration_end),
            (calibration_end, len(weeks)),
        ]
    ]
    if any(len(c) < 10 or len({s[3] for s in c}) < 2 for c in chunks):
        return {
            "validation_status": "not_ready",
            "reason": "Each chronological split needs at least 10 samples and both target classes",
        }
    X, y = np.array([s[2] for s in chunks[0]]), np.array([s[3] for s in chunks[0]])
    model = LogisticRegression(random_state=7, max_iter=1000).fit(X, y)
    cal_x = model.decision_function([s[2] for s in chunks[1]]).reshape(-1, 1)
    calibration = LogisticRegression(random_state=7).fit(cal_x, [s[3] for s in chunks[1]])
    test_x = np.array([s[2] for s in chunks[2]])
    probabilities = calibration.predict_proba(model.decision_function(test_x).reshape(-1, 1))[:, 1]
    test_y = np.array([s[3] for s in chunks[2]])
    brier = float(brier_score_loss(test_y, probabilities))
    baseline = float(brier_score_loss(test_y, np.repeat(float(y.mean()), len(test_y))))
    # Compose the linear Platt transform into additive log-odds factors.
    coefficients = model.coef_[0] * calibration.coef_[0, 0]
    intercept = float(model.intercept_[0] * calibration.coef_[0, 0] + calibration.intercept_[0])
    signals = []
    for key, counts in sorted(groups.items()):
        recent = [counts[w] for w in weeks[-4:]]
        features = [recent[-1], sum(recent) / 4, recent[-1] - sum(recent) / 4]
        factors = (coefficients * np.array(features)).tolist()
        score = intercept + sum(factors)
        signals.append(
            {
                "district": key[0],
                "category": key[1],
                "probability": float(1 / (1 + np.exp(-np.clip(score, -700, 700)))),
                "intercept": intercept,
                "factors": dict(zip(["last_week", "rolling_mean", "change"], factors, strict=True)),
            }
        )
    return {
        "validation_status": "validated" if brier < baseline else "rejected",
        "brier_score": brier,
        "baseline_brier": baseline,
        "target": "Next complete district-category week exceeds 1.5 times its preceding four-week mean and exceeds 2 incidents",
        "splits": [
            {
                "name": name,
                "samples": len(c),
                "start": str(weeks[min(s[0] for s in c)]),
                "end": str(weeks[max(s[0] for s in c)]),
            }
            for name, c in zip(["training", "calibration", "test"], chunks, strict=True)
        ],
        "calibration": "Logistic Platt calibration on chronological calibration split",
        "coefficients": coefficients.tolist(),
        "intercept": intercept,
        "signals": signals,
        "drift": {
            "training_feature_mean": X.mean(axis=0).tolist(),
            "test_feature_mean": test_x.mean(axis=0).tolist(),
            "mean_standardized_shift": float(
                np.mean(abs(test_x.mean(axis=0) - X.mean(axis=0)) / (X.std(axis=0) + 1))
            ),
        },
        "limitations": "Aggregate reference model only. No individual prediction. Zero-filled weeks assume complete reporting; changing coverage invalidates this assumption. Factors are additive log-odds, not causal effects. Activation is required; signals reflect the stored dataset snapshot.",
    }


def context_analysis(rows, data):
    for field in ("source_name", "source_url", "licence", "provenance", "indicator_code", "period"):
        if not data.get(field):
            raise ValueError(f"Context requires {field}")
    if data["provenance"] not in {"synthetic_demo", "uploaded_unverified", "official_declared"}:
        raise ValueError("Invalid context provenance")
    if not re.match(r"^https?://", data["source_url"]):
        raise ValueError("Source URL must be HTTP(S); it is recorded, never fetched")
    indicators = data.get("indicators", [])
    seen = set()
    for item in indicators:
        for field in (
            "district_code",
            "period",
            "indicator_code",
            "indicator_name",
            "value",
            "unit",
        ):
            if field not in item:
                raise ValueError(f"Indicator requires {field}")
        key = (item["district_code"], item["period"], item["indicator_code"])
        if key in seen or not np.isfinite(float(item["value"])):
            raise ValueError("Duplicate indicator or nonfinite value")
        seen.add(key)
    period = data["period"]
    pop = {
        i["district_code"]: float(i["value"])
        for i in indicators
        if i["indicator_code"] == "population" and i["period"] == period
    }
    values = {
        i["district_code"]: float(i["value"])
        for i in indicators
        if i["indicator_code"] == data["indicator_code"] and i["period"] == period
    }
    counts = Counter(r["district_code"] for r in rows)
    matched = sorted(set(counts) & set(pop) & set(values))
    points = [
        {
            "district": d,
            "indicator": values[d],
            "incidents": counts[d],
            "population": pop[d],
            "rate_per_100000": counts[d] / pop[d] * 100000,
        }
        for d in matched
        if pop[d] > 0
    ]
    correlation = None
    if (
        len(points) >= 5
        and len({p["indicator"] for p in points}) > 1
        and len({p["rate_per_100000"] for p in points}) > 1
    ):
        result = spearmanr([p["indicator"] for p in points], [p["rate_per_100000"] for p in points])
        correlation = {"rho": float(result.statistic), "p_value": float(result.pvalue)}
    return {
        "points": points,
        "correlation": correlation,
        "minimum_districts": 5,
        "unmatched_incident_districts": sorted(set(counts) - {p["district"] for p in points}),
        "unmatched_indicator_districts": sorted(set(values) - set(counts)),
        "context_period": period,
        "incident_period": [
            min((r["occurred_at"] for r in rows), default=None),
            max((r["occurred_at"] for r in rows), default=None),
        ],
        "limitation": "District-level association is non-causal; rates are for the selected incident period and are not annualized. Reporting and period mismatches affect interpretation.",
    }
