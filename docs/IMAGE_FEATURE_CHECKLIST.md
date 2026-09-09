# Challenge image coverage — CrimeStack 0.2.0-rc.2

Every visible capability from both supplied images is mapped below. Implemented code and automated tests do not imply that blocked browser/production deployment gates passed.

| Image capability | Where to use it | Implementation and scope |
|---|---|---|
| Interactive dashboards and geospatial maps | Command Centre | Dataset-derived metrics/charts, MapLibre points/clusters/heatmap, filters and saved views |
| Crime hotspot detection | Command Centre, Copilot | Connected density cells from historical records; not forecasts |
| District-level drilldowns | Command Centre, Pattern Discovery | District/category/date filters, clickable ranking bars |
| Trend alerts and anomaly detection | Early Warnings | Explicit weekly baseline, thresholds, scores and review history |
| Network/link analysis | Network Intelligence, Copilot | Separate authorized/synthetic relationships, graph, components, filters and inspector |
| Repeat offender tracking | Multiple-case links filter; Copilot “Show repeat cases” | Tracks distinct documented case links/dates. Does not infer repeat offending or guilt |
| Socio-economic crime correlation | Socio-Economic Context, Copilot | District indicators, population rates, Spearman, matched codes and periods; non-causal |
| Predictive risk scoring | Risk Models, Copilot | District-category weekly probabilities only; calibration, holdout rejection and supervisor activation |
| AI/ML pattern detection | Pattern Discovery | Seeded Isolation Forest on historical weekly aggregate cells; temporal distributions and descriptive deviations |
| Crime pattern discovery | Pattern Discovery, Copilot | Hour/day distributions, district-category segments, unusual weekly cells |
| Natural-language chatbot English + Kannada | Copilot | Bounded bilingual routing/templates; optional AI tool-routing provider. Not unrestricted free-form reasoning without a provider |
| Voice-enabled interaction | Copilot Voice / Read answers | Browser en-IN/kn-IN recognition/TTS; unsupported-browser messages; no CrimeStack audio storage |
| Context-aware conversations | Copilot | District/category/date scope, explicit dates and month/year windows, scope reset |
| PDF conversation history | Export conversation PDF | Dedicated transcript print root with citations; browser Save as PDF, not the whole dashboard |
| Criminal network visualization | Network Intelligence, Copilot | Declared entity graph, typed relationships, case inspector, viewer masking; no guilt inference |
| Crime trends/hotspots | Command Centre, Copilot | Monthly aggregates and reproducible density summaries |
| Predictive analytics and early warnings | Risk Models, Early Warnings | Clearly separates validated aggregate probabilities from historical warnings |
| Explainable AI with audit trails | Models, Patterns, Security and Audit | Additive model log-odds, disclosed pattern features/method, citations and audit chain |
| Role-based secure access | Authentication, Security and Audit | Viewer/analyst/supervisor/admin API checks, bootstrap and expiring sessions |
| Socio-demographic insights | Context Lab, Copilot | Imported district-level indicators only, not protected-attribute person profiles |
| Behavioral profiling | Pattern Discovery | Scoped to aggregate recorded time/category patterns. Individual behavioral profiles and future criminality predictions are deliberately excluded |
| Proactive prevention intelligence | Evidence review actions, Copilot | Evidence-grounded reporting/quality/comparison review steps, not arrests or unsupported enforcement decisions |

## UI

Light slate canvas, white panels, navy navigation, clearer hierarchy, readable tables, larger labels, responsive layouts and focus states replace the dense all-dark UI. Raw JSON is no longer the default result view. Provenance remains visible.

The import button is beside required source fields and a readiness explanation. Missing information produces an explicit message and focuses its field. Validation details are collapsed readable tables.

## Access limits

The screenshots describe a KSP/SCRB database; they do not provide credentials or data access. This package does not claim live access to KSP or 1100 stations. Use authorized uploads/source profiles. All bundled incidents, identities, cases and indicators are fictional.
