import json
import re
import calendar
from datetime import date

import httpx
from fastapi import HTTPException

from ..config import settings
from ..schemas import Scope, ToolCall
from .analytics import hotspots, metrics, warnings
from .patterns import discover
from .intelligence import context_analysis

REFUSAL = re.compile(
    r"who.{0,30}(commit|criminal)|individual.{0,25}(risk|criminal|score)|arrest|guilt|caste|religion|ethnic|protected.attribute|enforcement|ಯಾರು.{0,30}ಅಪರಾಧ|ಬಂಧಿಸ|ಜಾತಿ|ಧರ್ಮ",
    re.IGNORECASE,
)
INTENTS = [
    (
        "context",
        [
            "socio",
            "demograph",
            "correlation",
            "population",
            "per capita",
            "per-capita",
            "ಸಾಮಾಜಿಕ",
            "ಜನಸಂಖ್ಯೆ",
            "ಸಂಬಂಧಿತ ಸೂಚಕ",
        ],
    ),
    (
        "repeat_cases",
        [
            "repeat offender",
            "repeat case",
            "repeat-case",
            "case history",
            "ಪುನರಾವರ್ತಿತ",
            "ಪ್ರಕರಣ ಇತಿಹಾಸ",
        ],
    ),
    ("prevention", ["prevention", "review action", "next step", "ತಡೆಗಟ್ಟುವ", "ಪರಿಶೀಲನಾ ಕ್ರಮ"]),
    (
        "patterns",
        [
            "pattern",
            "busiest",
            "time of day",
            "weekday",
            "behavioral pattern",
            "ಮಾದರಿಗಳ ಅನ್ವೇಷಣೆ",
            "ವಾರದ ದಿನ",
            "ಯಾವ ಸಮಯ",
        ],
    ),
    ("hotspots", ["hotspot", "density", "ಹಾಟ್"]),
    ("warnings", ["warning", "anomal", "ಎಚ್ಚರಿಕೆ"]),
    ("network", ["network", "relationship", "connection", "ಜಾಲ"]),
    ("models", ["model", "risk", "signal", "ಮಾದರಿ"]),
    ("severity", ["severity", "severe", "high", "critical", "ತೀವ್ರ"]),
    ("trends", ["trend", "month", "ಪ್ರವೃತ್ತಿ", "ತಿಂಗಳು"]),
    ("districts", ["district", "ಜಿಲ್ಲೆ"]),
    ("categories", ["categor", "type", "ವರ್ಗ"]),
    ("totals", ["total", "count", "how many", "incidents", "ಒಟ್ಟು", "ಎಷ್ಟು"]),
]


def route(question, context, all_rows, previous_tool=None):
    scope = context.model_dump()
    recognized_scope = False
    lower = question.lower()
    for native, canonical_name in {
        "ಬೆಂಗಳೂರು": "Bengaluru",
        "ಮೈಸೂರು": "Mysuru",
        "ಮಂಗಳೂರು": "Mangaluru",
        "ಹುಬ್ಬಳ್ಳಿ": "Hubballi",
        "ಬೆಳಗಾವಿ": "Belagavi",
        "ಬಳ್ಳಾರಿ": "Ballari",
        "ಕಳ್ಳತನ": "Theft",
        "ವಂಚನೆ": "Fraud",
    }.items():
        lower = lower.replace(native, canonical_name.lower())
    if any(w in lower for w in ["reset scope", "all districts", "ಎಲ್ಲಾ ಜಿಲ್ಲೆ"]):
        scope["district"] = None
    if "all categories" in lower:
        scope["category"] = None
    for field, key in [("district_code", "district"), ("category", "category")]:
        for value in sorted({r[field] for r in all_rows if r[field]}, key=len, reverse=True):
            if re.search(r"(?<!\w)" + re.escape(value.lower()) + r"(?!\w)", lower):
                scope[key] = value
                recognized_scope = True
                break
    # Only deterministic, explicitly expressed calendar windows; never invent dates.
    if any(w in lower for w in ["all dates", "all time", "reset dates"]):
        scope["start"] = scope["end"] = None
        recognized_scope = True
    explicit_dates = re.findall(r"\b\d{4}-\d{2}-\d{2}\b", lower)
    if len(explicit_dates) == 2:
        scope["start"], scope["end"] = explicit_dates
    elif len(explicit_dates) == 1:
        scope["start"] = scope["end"] = explicit_dates[0]
    else:
        for month in range(1, 13):
            match = re.search(r"\b" + calendar.month_name[month].lower() + r"\s+(\d{4})\b", lower)
            if match:
                year = int(match.group(1))
                scope["start"] = date(year, month, 1).isoformat()
                scope["end"] = date(year, month, calendar.monthrange(year, month)[1]).isoformat()
                break
    for intent, words in INTENTS:
        if any(w in lower for w in words):
            return ToolCall(tool=intent, scope=Scope(**scope))
    if recognized_scope or any(w in lower for w in ["what about", "and ", "ಅಲ್ಲಿ"]):
        return ToolCall(
            tool=previous_tool.tool if previous_tool else "totals", scope=Scope(**scope)
        )
    return None


def provider_route(question, context, previous_tool=None):
    # Fixed approved endpoint; untrusted text never controls SQL or outbound URLs.
    schema = ToolCall.model_json_schema()
    try:
        response = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings().llm_api_key}"},
            json={
                "model": settings().llm_model,
                "messages": [
                    {
                        "role": "system",
                        "content": "Convert an aggregate analytics question to a controlled tool call. Retain provided scope and previous tool for follow-up questions unless explicitly changed. Never answer facts. Schema: "
                        + json.dumps(schema),
                    },
                    {
                        "role": "user",
                        "content": json.dumps(
                            {
                                "question": question,
                                "context": context.model_dump(),
                                "previous_tool": previous_tool.model_dump()
                                if previous_tool
                                else None,
                            }
                        ),
                    },
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0,
            },
            timeout=15,
        )
        response.raise_for_status()
        return ToolCall.model_validate_json(response.json()["choices"][0]["message"]["content"])
    except (httpx.HTTPError, ValueError, KeyError, IndexError) as exc:
        raise HTTPException(
            502,
            "AI routing provider failed or returned an invalid tool request. Retry or disable the provider for rules-based mode.",
        ) from exc


def answer(request, dataset, all_rows, network, models, contexts=None):
    mode = (
        "AI tool-routing mode"
        if settings().llm_api_key and settings().llm_model
        else "Rules-based evidence mode"
    )
    if REFUSAL.search(request.question):
        return {
            "answer": "ವ್ಯಕ್ತಿಯ ಅಪರಾಧಿತ್ವ, ಬಂಧನ ಅಥವಾ ಅಪರಾಧ ಮಾಡುವವರ ಭವಿಷ್ಯವಾಣಿ ನೀಡಲು ಸಾಧ್ಯವಿಲ್ಲ."
            if request.language == "kn"
            else "I cannot predict individual criminality, profile protected attributes, determine guilt, or recommend arrests or enforcement. Ask about aggregate historical patterns.",
            "refused": True,
            "citations": [],
            "context": request.context.model_dump(),
            "mode": mode,
            "followups": ["Show total incidents"],
        }
    try:
        call = (
            provider_route(request.question, request.context, request.previous_tool)
            if mode.startswith("AI")
            else route(request.question, request.context, all_rows, request.previous_tool)
        )
    except ValueError as exc:
        raise HTTPException(
            422, "Invalid calendar window. Use valid dates and put the start before the end."
        ) from exc
    if call is None:
        raise HTTPException(
            422,
            "Unsupported question. Ask about totals, severity, districts, categories, trends, hotspots, warnings, networks, aggregate models, patterns, repeat cases, or socio-economic context.",
        )
    scope = call.scope.model_dump()
    rows = [
        r
        for r in all_rows
        if (not scope["district"] or r["district_code"] == scope["district"])
        and (not scope["category"] or r["category"] == scope["category"])
        and (not scope["start"] or r["occurred_at"][:10] >= scope["start"])
        and (not scope["end"] or r["occurred_at"][:10] <= scope["end"])
    ]
    m = metrics(rows)
    values = {
        "totals": m["total"],
        "severity": m["severity"],
        "districts": m["districts"],
        "categories": m["categories"],
        "trends": m["monthly"],
    }
    auxiliary_refs = []
    if call.tool in {"patterns", "prevention"}:
        discovery = discover(rows)
        value = (
            discovery
            if call.tool == "patterns"
            else {
                "review_actions": discovery["review_actions"],
                "limitations": discovery["limitations"],
            }
        )
    elif call.tool == "repeat_cases":
        value = {
            "entities": [n for n in network["nodes"] if n["case_count"] > 1],
            "limitation": "Multiple documented case links are not proof of repeat offending, guilt or future criminality.",
        }
        auxiliary_refs = network.get("evidence_refs", [])
    elif call.tool == "context":
        value = [
            {
                "record_id": c["record_id"],
                "source_name": c["source_name"],
                "source_url": c["source_url"],
                "provenance": c["provenance"],
                **context_analysis(rows, c),
            }
            for c in (contexts or [])
        ]
        auxiliary_refs = [f"record:{c['record_id']}" for c in (contexts or [])]
    elif call.tool == "hotspots":
        value = hotspots(rows)
    elif call.tool == "warnings":
        value = warnings(rows)
    elif call.tool == "network":
        value = network
        auxiliary_refs = network.get("evidence_refs", [])
    elif call.tool == "models":
        value = [
            {
                **model,
                "signals": [
                    signal
                    for signal in model.get("signals", [])
                    if (not scope["district"] or signal["district"] == scope["district"])
                    and (not scope["category"] or signal["category"] == scope["category"])
                ],
            }
            for model in models
        ]
        auxiliary_refs = [f"record:{model['record_id']}" for model in models]
    else:
        value = values[call.tool]
    if not rows and call.tool not in {"network", "models", "repeat_cases"}:
        message = (
            "ಈ ಆಯ್ಕೆಯಲ್ಲಿ 0 ಘಟನೆಗಳಿವೆ."
            if request.language == "kn"
            else "There are 0 incidents matching the combined conversation scope."
        )
    else:
        message = (
            f"ಆಯ್ದ ದತ್ತಾಂಶದಲ್ಲಿ {len(rows)} ಘಟನೆಗಳಿವೆ. ವಿನಂತಿಸಿದ ವಿಶ್ಲೇಷಣೆ ಕೆಳಗಿದೆ."
            if request.language == "kn"
            else f"The selected scope contains {len(rows)} incidents. {call.tool.title()} results are shown below."
        )
    if call.tool == "totals" and rows:
        message = (
            f"There are {len(rows):,} incidents in the selected scope."
            if request.language == "en"
            else f"ಆಯ್ದ ವ್ಯಾಪ್ತಿಯಲ್ಲಿ {len(rows)} ಘಟನೆಗಳಿವೆ."
        )
    if call.tool in {"context", "models"} and not value:
        message = (
            (
                "No socio-economic indicator data has been imported for this dataset."
                if call.tool == "context"
                else "No aggregate model is active for this dataset. Train and validate a model, then request supervisor activation."
            )
            if request.language == "en"
            else (
                "ಈ ದತ್ತಾಂಶಕ್ಕೆ ಸಾಮಾಜಿಕ-ಆರ್ಥಿಕ ಸೂಚಕಗಳು ಲಭ್ಯವಿಲ್ಲ."
                if call.tool == "context"
                else "ಈ ದತ್ತಾಂಶಕ್ಕೆ ಸಕ್ರಿಯ ಮಾದರಿ ಲಭ್ಯವಿಲ್ಲ."
            )
        )
    sources = {source["evidence_ref"]: source for source in network.get("evidence_sources", [])}
    sources.update(
        {
            f"record:{c['record_id']}": {
                "provenance": c["provenance"],
                "source_name": c["source_name"],
                "source_url": c["source_url"],
            }
            for c in (contexts or [])
        }
    )
    return {
        "tool": call.tool,
        "answer": message,
        "result": value,
        "context": scope,
        "previous_tool": call.model_dump(),
        "mode": mode,
        "citations": [
            {
                "dataset_id": dataset.id,
                "dataset_name": dataset.name,
                "checksum": dataset.checksum,
                "provenance": dataset.provenance,
                "tool": call.tool,
                "scope": scope,
                "matched_rows": len(rows),
                "evidence_ref": f"dataset:{dataset.id}",
                "auxiliary_scope": "Network case links use the full selected dataset. Model signals use district/category filters but retain their training snapshot date window."
                if call.tool in {"network", "models", "repeat_cases"}
                else None,
            }
        ]
        + [
            {
                "dataset_id": dataset.id,
                "dataset_name": dataset.name,
                "provenance": dataset.provenance,
                "tool": call.tool,
                "evidence_ref": ref,
                "scope": scope,
                "matched_rows": None,
                **sources.get(ref, {}),
            }
            for ref in auxiliary_refs
        ],
        "followups": ["Show severity distribution", "Show monthly trends", "Show hotspots"],
        "limitation": "Counts describe uploaded records; provenance is not independently authenticated.",
    }
