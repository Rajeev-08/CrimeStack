# Acceptance status — 0.2.0-rc.2

This is runnable application source, not a fully accepted production system. The database, imports, calculations, role enforcement and model training execute on the backend. The included datasets and network identities are fictional, and no KSP connection exists.

## Corrections in this release

- Follow-up questions preserve the previous analysis tool as well as district/category/date scope, including when sent to the optional provider.
- Invalid dates typed in questions return a useful HTTP 422 instead of a server error.
- Copilot shows its configured mode before the first question. A configured API key is not presented as proof of working connectivity.
- Audit entries now include the selected tool, applied scope and evidence references.
- Navigation groups now keep casework and data/governance items together.

## What is still required for full acceptance

| Capability | Current implementation | Remaining acceptance work |
|---|---|---|
| Professional UI | Responsive light workspace, structured results, readable charts/tables | Real desktop/mobile visual review and browser E2E blocked by this session's browser policy |
| English/Kannada AI | Guided bilingual queries plus optional controlled AI routing | Supply backend LLM_API_KEY and LLM_MODEL, test actual provider and Kannada phrasing with a fluent speaker |
| Voice | Browser recognition and speech synthesis | Microphone permissions and browser/OS Kannada speech support must be tested on target machine |
| Conversation PDF | Focused browser print export | Verify Save as PDF rendering in target browser |
| Maps | MapLibre rendering and uploaded coordinates | Real WebGL, external basemap and device interaction verification |
| Data | Authorized CSV and auxiliary record import | Supply actual authorized data; fixtures do not demonstrate real KSP integration |
| Predictions | Trained, validated district/category model with activation gate | Validate using representative real data and held-out periods |
| Repeat-case links | Supplied dated case relationships | Requires authorized case identifiers; links do not establish offending or guilt |
| Behavioral analysis | Aggregate historical time/category patterns | Individual criminality prediction is outside this application's scope |
| Windows setup | Isolated venv and locked dependencies launcher | Execute on Windows; source review alone is insufficient |

No actual LLM provider, microphone, PDF, WebGL or live police database test is claimed. Read IMAGE_FEATURE_CHECKLIST.md for every screenshot requirement and UI_TEST_WALKTHROUGH.md for the manual acceptance sequence.
