# CrimeStack

A crime-data analytics workspace built with React, TypeScript, FastAPI and MapLibre. Import incident records, explore geographic and temporal patterns, inspect declared case relationships, and query evidence through an English/Kannada Copilot.

**Current application release: 0.2.0-rc.2.** This is a release candidate with working backend implementations and automated tests, not a fully verified production deployment.

## Features

| Area | Included functionality |
|---|---|
| Data ingestion | CSV validation, column mapping, quality summaries, provenance, duplicate handling and import feedback |
| Dashboard and maps | Dataset metrics, trends, district/category/date filters, geospatial points/clusters/heatmap and historical hotspots |
| Pattern discovery | Hour/day distributions, district/category segments and Isolation Forest aggregate anomaly detection |
| Early warnings | Historical baseline comparisons and review workflows |
| Network intelligence | Declared relationship graph, components, multiple-case links and dated case-history inspection |
| Socio-economic context | Imported district indicators, population rates and non-causal correlations |
| Risk models | District/category models, validation, explanations and supervisor activation gates |
| Copilot | Guided bilingual queries, optional AI tool routing, follow-up scope/tool context and evidence citations |
| Voice and export | Browser speech recognition/read-aloud and focused conversation print-to-PDF |
| Governance | Role-based API access, audit trail, investigations, tasks and briefings |

The interface uses a light workspace, navy navigation, structured evidence tables and responsive layouts. See [the image feature checklist](docs/IMAGE_FEATURE_CHECKLIST.md) for detailed scope.

## What “real” means here

- Metrics and models execute against imported records; they are not hardcoded dashboard results.
- All bundled sample incidents, entities, cases and indicators are fictional. No live KSP/SCRB database connection is included.
- Supply authorized datasets and retain their actual source/provenance. An official-source label is a declaration, not independent authentication.
- Multiple case links do not establish guilt or repeat offending. Predictions cover district/category aggregates; the application does not predict individual criminality.
- Without an AI provider configuration, Copilot supports guided bilingual queries. Configuring a provider enables controlled tool routing, not unrestricted questions or arbitrary database access.

## Browser to use

Start with the **latest stable desktop Google Chrome on Windows**. Use Microsoft Edge as a secondary layout/map/PDF test, but do not assume identical speech support.

Open the served application at `http://127.0.0.1:5173`; do not open `index.html` directly. Allow microphone access when testing Voice. Speech recognition can use a remote browser service and may require internet connectivity. Kannada recognition and installed read-aloud voices vary by environment.

The earlier browser-security block applied to the development agent's environment. It does not prevent local testing on your computer. No browser security settings need to be disabled.

Reference: [MDN SpeechRecognition compatibility and limitations](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

## Run on Windows without Docker

### Prerequisites

Install Python **3.12**, including the Windows `py` launcher, and Node.js **22 or newer** with npm. Install Git if you plan to upload the source.

Check in PowerShell:

```powershell
py -3.12 --version
node --version
npm --version
git --version
```

### Start both services

1. Extract the release ZIP completely.
2. Open the extracted `crimestack` folder.
3. Double-click `RUN_WINDOWS.cmd`.
4. Wait for dependency installation, database migration, API readiness and Vite startup.
5. Open `http://127.0.0.1:5173` in Chrome.

The launcher creates `apps/api/.venv`, installs locked Python dependencies, installs frontend dependencies in `apps/web/node_modules`, and starts both services. The frontend uses Node.js rather than the Python virtual environment.

Keep the running windows open. Use Ctrl+C to stop. Initial dependency installation needs internet access. The Windows launcher has been source-reviewed but was not executed on Windows during release testing.

### First account

For a fresh database, create the administrator through the bootstrap screen. Enter an email, a password of at least 12 characters and the `BOOTSTRAP_SECRET` from `apps/api/.env`. The example value is `local-bootstrap-change-me`; configure your own before sharing access. Bootstrap is available only for the first administrator.

Existing database: sign in with your existing account. To upgrade, stop both services, back up `apps/api/crimestack.db` and `apps/api/.env`, and follow [the upgrade guide](docs/UPGRADE_0.2.md). Do not copy an old virtual environment or `node_modules` into a fresh release.

### Manual setup if the launcher fails

Terminal 1, from the extracted `crimestack` directory:

```powershell
cd apps\api
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install uv
.\.venv\Scripts\uv.exe sync --frozen
if (!(Test-Path .env)) { Copy-Item ..\..\.env.example .env }
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn crimestack.main:app --host 127.0.0.1 --port 8000
```

Terminal 2, from the same project root:

```powershell
cd apps\web
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

API documentation: `http://127.0.0.1:8000/docs`.

Linux/macOS: install Python 3.12, uv and Node.js 22+, then run `bash scripts/start.sh` from the project root.

## Enable AI routing

The current adapter calls OpenAI's API. Edit **`apps/api/.env`**, not a frontend file:

```dotenv
LLM_API_KEY=YOUR_API_KEY
LLM_MODEL=YOUR_ACCESSIBLE_CHAT_COMPLETIONS_MODEL
```

Replace both placeholders. The model must support the adapter's Chat Completions JSON response mode. Restart the backend. Copilot should display **AI tool routing**. Ask a supported analytics question to test actual connectivity; the status badge confirms configuration only.

Keep keys out of GitHub and never prefix the key with `VITE_`. Do not put actual keys in `.env.example`. The adapter sends the question, scope and previous tool to its provider, so avoid putting private case details into questions without authorization.

To return to guided mode, leave both values empty and restart. Provider errors are shown explicitly rather than silently replaced by invented answers.

## Import and test in the UI

1. **Data Registry:** select `data/examples/synthetic-karnataka.csv`. Inspect accepted/rejected and map-ready counts. Enter a dataset name and publisher such as `CrimeStack fictional generator`; choose synthetic provenance and confirm.
2. **Import validation:** try confirmation with the publisher blank. The UI should explain the missing field and focus it. Fill it and confirm; the dataset should appear.
3. **Command Centre:** select the imported dataset. Change district/category filters and check that totals, trends and map points change consistently. Test map zoom, pan, clusters and heatmap. Missing coordinates should affect map-ready counts.
4. **Pattern Discovery / Early Warnings:** inspect real calculated distributions and baseline results. Small datasets can legitimately be insufficient for ML or warning generation.
5. **Network Intelligence:** import `synthetic-network.json` against the dataset. Inspect entities, multiple-case links and dated histories.
6. **Socio-Economic Context:** import `synthetic-context.json`. Check matched districts, rates and correlation limitations.
7. **Risk Models:** import `synthetic-long-duration.csv` separately and select it. Train and inspect validation results. Activation is gated; a rejected model should not be forced active.
8. **Copilot:** ask `Show severity in Bengaluru in January 2026`, then `What about Mysuru?`. Verify the tool stays severity and the date scope persists. Try `all dates` and Reset context. Inspect citations.
9. **Voice:** choose English, click Voice, allow microphone access and speak. Repeat in Kannada. Check recognition and read-aloud separately. Unsupported services must report an error, not claim success.
10. **PDF:** after a conversation, click Export conversation PDF, choose Save as PDF in the print dialog, and inspect the saved file. Check Kannada text, citations, page breaks and absence of navigation controls.
11. **Access control:** create separate viewer/analyst/supervisor accounts through an administrator. Verify restricted actions and audit entries. Check the interface at desktop and narrow widths.

See [the full UI walkthrough](docs/UI_TEST_WALKTHROUGH.md). Record the browser version, failed step, screenshot, Console error and relevant Network response when reporting a failure. Remove tokens/private data from shared logs.

## Automated verification

Latest recorded checks: **69 backend tests passed, 23 frontend tests passed, TypeScript/Vite build passed, Ruff checks passed.** Browser E2E, real voice/PDF/WebGL, live provider, Windows execution and Docker deployment were not verified in the build environment.

After setup, run from project root in PowerShell:

```powershell
cd apps\api
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check src tests migrations
cd ..\web
npm test -- --run
npm run build
```

To run browser E2E locally, stop the normal backend first and free ports 8000 and 5175. The Playwright configuration starts an isolated test API and frontend. It requires `uv` available on PATH. From project root in a new PowerShell window:

```powershell
py -3.12 -m pip install --user uv
uv --version
cd apps\web
npx playwright install chromium
npm run test:e2e -- --reporter=list,html
npx playwright show-report
```

If `uv` is not found, add the Python user Scripts directory reported by pip to your PATH and reopen PowerShell. The reporter option generates an HTML report; `test-results` also contains retained failure traces. Automated Chromium tests do not replace manual microphone, Kannada or PDF inspection.

Full release/deployment gates and their limits: [acceptance status](docs/ACCEPTANCE_STATUS.md), [release report](docs/RELEASE_REPORT.md), [test results](docs/TEST_RESULTS.json).


## Further documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Data schemas and provenance](docs/DATA.md)
- [Copilot](docs/COPILOT.md)
- [Geospatial behavior](docs/GEOSPATIAL.md)
- [Security](docs/SECURITY.md)
- [Operations](docs/OPERATIONS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

Local evaluation uses SQLite. Production configuration requires PostgreSQL, strong distinct secrets and deployment hardening. Docker instructions remain available in the repository configuration and operations documentation; Docker is not required for the local workflow above.
