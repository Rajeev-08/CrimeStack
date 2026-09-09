# CrimeStack 0.2.0-rc.2 — release report

This package contains the complete updated source, locked dependencies, examples, tests and run instructions. It is a reference release candidate, not a claim that all deployment gates have passed.

## Changes verified in code

- Rebuilt the UI around a light slate workspace, white panels, navy navigation, readable tables and responsive layouts.
- Replaced raw JSON as the default result display throughout the application.
- Fixed the confusing import interaction: missing required metadata is explained and its field is focused; confirmation is adjacent to the source form.
- Added Pattern Discovery: time distributions, district/category segments, historical aggregate Isolation Forest outliers and evidence review actions.
- Added network component/multiple-case filtering, entity table and dated case-history inspector; masking applies to histories as well as graph IDs.
- Added cited Copilot pattern, repeat-case, context and prevention tools; district/category/date context and natural month/year filters.
- Showed model splits, candidate/active probabilities and additive explanations as readable tables.
- Added focused conversation/brief print-to-PDF exports and explicit unsupported voice handling.
- Added a Windows launcher and upgrade guide that preserve the user's database and environment configuration.

## Test results

Final counts and gate results are stored in `docs/TEST_RESULTS.json`. The final release ran backend tests, frontend tests, TypeScript/Vite build, Ruff checks and lock validation. SQLite migration round-trips are in the backend suite. Tests include the exact missing-publisher import regression, new Copilot tools/calendar context, network history/masking, deterministic ML pattern discovery, structured results and focused print export.

## Open verification gates

The session's browser security policy previously rejected access to the local UI. That rejection was not bypassed. No real-browser screenshot, mobile visual inspection, microphone check, PDF rendering check or Playwright E2E pass is claimed for this redesign. React component tests use a simulated DOM, and map unit tests mock MapLibre; they are not real WebGL validation.

Docker is unavailable here, so Compose/image/PostgreSQL/PostGIS deployment verification remains unexecuted. The Windows launcher is source-reviewed, not executed on Windows in this Linux environment. The full `scripts/verify.sh` includes the blocked gates and is not claimed to have passed. Run CI/the local acceptance suite before treating this as fully verified.

## Remaining scope distinctions

`docs/IMAGE_FEATURE_CHECKLIST.md` maps every image capability. Person-level behavioral/criminality profiling and guilt/offender inference are deliberately excluded. Repeat-case tracking shows supplied relationships and dates. Predictions are district-category aggregates. Prevention tools suggest evidence/data review, not arrests. The optional provider enables controlled AI routing; without a key, bilingual support is deterministic and bounded, not general language understanding. No real KSP/SCRB access is implied.

## Non-blocking warnings

Vite reports a large MapLibre-containing main chunk (about 1.34 MB uncompressed). Tests emit two upstream FastAPI/Starlette deprecation warnings. The npm environment emits an unknown http-proxy config warning. None caused a failing local check.

All bundled incidents, identities, cases and indicators are fictional. Real basemap context does not authenticate uploaded incidents. This reference application is not police production approval.

See `docs/ACCEPTANCE_STATUS.md` for the rc.2 fixes and remaining live acceptance work.
