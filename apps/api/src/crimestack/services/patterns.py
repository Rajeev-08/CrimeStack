"""Historical aggregate pattern discovery; no person-level features or predictions."""

from collections import Counter, defaultdict
from datetime import datetime, timedelta

import numpy as np
from sklearn.ensemble import IsolationForest

from .analytics import week, warnings

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def discover(rows):
    hours = Counter()
    weekdays = Counter()
    matrix = Counter()
    group_rows = defaultdict(list)
    for row in rows:
        occurred = datetime.fromisoformat(row["occurred_at"])
        hours[occurred.hour] += 1
        weekdays[occurred.weekday()] += 1
        matrix[(occurred.weekday(), occurred.hour // 4)] += 1
        group_rows[(row["district_code"] or "Unspecified", row["category"])].append(row)
    segments = []
    for (district, category), items in sorted(group_rows.items()):
        counts = Counter(week(row["occurred_at"]) for row in items)
        segments.append(
            {
                "district": district,
                "category": category,
                "incidents": len(items),
                "active_weeks": len(counts),
                "high_severity": sum(row["severity"] in {"high", "critical"} for row in items),
                "first_seen": min(row["occurred_at"] for row in items),
                "last_seen": max(row["occurred_at"] for row in items),
            }
        )
    samples = []
    if rows:
        first, last = (
            min(week(r["occurred_at"]) for r in rows),
            max(week(r["occurred_at"]) for r in rows),
        )
        # Complete interior weeks only; cap pathological sparse ranges before materializing.
        week_count = (last - first).days // 7 - 1
        if week_count > 5200 or week_count * len(group_rows) > 100000:
            raise ValueError(
                "Pattern analysis is limited to 100,000 district-category week cells and 100 years"
            )
        for (district, category), items in sorted(group_rows.items()):
            by_week = Counter(week(r["occurred_at"]) for r in items)
            severe = Counter(
                week(r["occurred_at"]) for r in items if r["severity"] in {"high", "critical"}
            )
            for offset in range(1, (last - first).days // 7):
                current = first + timedelta(weeks=offset)
                samples.append(
                    {
                        "district": district,
                        "category": category,
                        "week": str(current),
                        "count": by_week[current],
                        "high_severity": severe[current],
                    }
                )
    detection = {
        "status": "not_ready",
        "reason": "Needs at least 30 district-category week cells and variation in weekly counts.",
        "algorithm": "Isolation Forest on historical weekly aggregates",
        "sample_count": len(samples),
        "anomalies": [],
    }
    if len(samples) >= 30 and len({s["count"] for s in samples}) > 1:
        features = np.array([[s["count"], s["high_severity"]] for s in samples], dtype=float)
        model = IsolationForest(
            n_estimators=80, random_state=42, contamination="auto", n_jobs=1
        ).fit(features)
        scores = -model.decision_function(features)
        median = np.median(features, axis=0)
        anomalies = [
            {
                **sample,
                "anomaly_score": round(float(score), 4),
                "count_above_median": round(float(sample["count"] - median[0]), 2),
                "severity_above_median": round(float(sample["high_severity"] - median[1]), 2),
            }
            for sample, score in zip(samples, scores, strict=True)
            if score > 0
        ]
        detection.update(
            status="ready",
            reason=None,
            anomalies=sorted(
                anomalies,
                key=lambda s: (-s["anomaly_score"], s["week"], s["district"], s["category"]),
            )[:25],
            total_anomalies=len(anomalies),
            feature_medians={
                "weekly_count": float(median[0]),
                "high_severity_count": float(median[1]),
            },
        )
    review_actions = []
    for warning in warnings(rows)[:8]:
        review_actions.append(
            {
                "scope": f"{warning['dimension']}: {warning['name']}",
                "observation": f"Latest count {warning['latest']}; four-week baseline {warning['baseline']}",
                "action": "Check reporting completeness and duplicate/source changes; compare equivalent weeks before interpreting the increase.",
                "warning_id": warning["id"],
            }
        )
    if rows and not review_actions:
        review_actions.append(
            {
                "scope": "Selected dataset",
                "observation": "No standard-threshold weekly count warning.",
                "action": "Check source coverage and unmatched district codes before comparing rates or trends.",
            }
        )
    return {
        "total_incidents": len(rows),
        "hourly": {f"{hour:02}:00": hours[hour] for hour in range(24)},
        "weekdays": {DAYS[day]: weekdays[day] for day in range(7)},
        "time_matrix": [
            {
                "day": DAYS[day],
                "period": f"{block * 4:02}:00–{block * 4 + 4:02}:00",
                "count": matrix[(day, block)],
            }
            for day in range(7)
            for block in range(6)
        ],
        "segments": sorted(segments, key=lambda s: (-s["incidents"], s["district"], s["category"])),
        "ml": detection,
        "review_actions": review_actions,
        "limitations": "Describes recorded aggregate patterns, not individual behavior or future criminality. Times use stored UTC. Incomplete boundary weeks are excluded from ML. Zero-filled interior weeks assume complete reporting. Isolation Forest scores are not probabilities; deviations from medians are descriptive context, not causal model contributions.",
    }
