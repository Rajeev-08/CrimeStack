# CrimeStack 0.2.0 — redesigned reference release candidate

Crime intelligence workspace using React/TypeScript/Vite/MapLibre and Python 3.12/FastAPI/SQLAlchemy. PostgreSQL/PostGIS in Docker; SQLite for local evaluation. No data is preloaded. All bundled example incidents, entities, cases and indicator values are fictional.

**Release status: verification incomplete.** Backend/frontend automated tests and the production frontend build were executed; browser access was rejected by the build environment and Docker was unavailable. The Playwright suite and Docker gates must pass on your machine/CI before this candidate satisfies the supplied completion criteria. See `docs/RELEASE_REPORT.md` for actual results and limitations.

## Upgrading from your current copy

Read `docs/UPGRADE_0.2.md` first. Stop both servers and preserve your database and `.env`. Extract this release into a new directory. On Windows, double-click **RUN_WINDOWS.cmd** to create the virtual environment and install/start both services. Python 3.12 and Node.js 22+ must already be installed.

New in 0.2: a light professional workspace, readable evidence tables, explicit import validation, ML Pattern Discovery, repeat-case history inspector, socio-economic Copilot queries, calendar scope and focused PDF exports. See `docs/IMAGE_FEATURE_CHECKLIST.md` for every capability from your images and its limits.

## Docker (optional evaluation)

Prerequisites: Docker Engine with Compose v2.

```bash
cp .env.example .env
# Edit .env: replace POSTGRES_PASSWORD, TOKEN_SECRET, SIGNING_SECRET, BOOTSTRAP_SECRET.
docker compose up --build --wait
```

Open http://localhost:8080. Compose binds the frontend to loopback; the API/database are not exposed. Windows: `Copy-Item .env.example .env`, then run the same Docker command.

First login: enter an administrator email, a password with at least 12 characters, and your configured `BOOTSTRAP_SECRET`. The bootstrap is one-time and persists in the database. The shipped development bootstrap secret is `local-bootstrap-change-me`; change it before use outside your own machine. Create other users from Security and Audit. Use separate identities to test the four roles.

Set `ENVIRONMENT=production` only with distinct strong secrets (at least 32 characters), PostgreSQL, HTTPS at an approved reverse proxy and the hardening controls described in `docs/SECURITY.md`. Use a URL-safe PostgreSQL password (e.g. hex) because Compose interpolates it into the database URL.

## Local without Docker

Prerequisites: Python 3.12, uv, Node.js 22+ and npm.

Linux/macOS:

```bash
./scripts/start.sh
```

Windows PowerShell:

```powershell
.\scripts\start.ps1
```

Open http://localhost:5173. These scripts copy `.env.example` to `apps/api/.env` only if missing, install locked packages, migrate SQLite, and start API plus frontend. Edit that local env file to change the bootstrap secret and other settings. Run only one local API instance on port 8000.

Manual, terminal 1:

```bash
cp .env.example apps/api/.env
cd apps/api
uv sync --frozen
uv run alembic upgrade head
uv run uvicorn crimestack.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```bash
cd apps/web
npm ci
npm run dev -- --host 127.0.0.1
```

## First dataset

1. Open Data Registry and choose `data/examples/synthetic-karnataka.csv`.
2. Inspect accepted/rejected/duplicate/map-ready counts, mappings, missing fields and quality.
3. Enter a name and publisher such as “CrimeStack fictional generator”. Choose **Synthetic — fictional demonstration**.
4. Confirm import. Command Centre computes metrics and maps actual coordinates in that upload.
5. Upload `synthetic-long-duration.csv` separately for model training. Train from Risk Models; only models beating their test baseline can activate.
6. In Network Intelligence, import `synthetic-network.json`. Its confirmation/authorization fields declare fictional data.
7. In Socio-Economic Context, import `synthetic-context.json` against an incident dataset. The `example.com` source URL is a recorded placeholder identifying fictional examples, never a real dataset source.

No official datasets are downloaded by this application. Real geographic coordinates and OpenStreetMap basemap context do **not** make synthetic crimes real.

## Verify

Stop the local API before E2E testing; it uses an isolated disposable database on port 8000.

```bash
cd apps/api
uv sync --frozen
uv run ruff format --check src tests migrations
uv run ruff check src tests migrations
uv lock --check
uv run pytest -q
cd ../web
npm ci
npm test -- --run
npm run build
npx playwright install chromium
npm run test:e2e
cd ../..
cp .env.example .env # only if you have not already configured it
./scripts/verify.sh
docker compose config
```

`verify.sh` deliberately fails if any gate fails or Docker is missing. No skip masquerades as a pass. CI also builds/starts the containers and runs HTTP smoke checks.

## Documentation

- `docs/ARCHITECTURE.md`: modules, APIs and implementation choices.
- `docs/DATA.md`: schemas, provenance, quality and examples.
- `docs/COPILOT.md`: supported intents, controlled provider routing, voice.
- `docs/GEOSPATIAL.md`: fallback maps and density algorithm.
- `docs/OPERATIONS.md`: migrations, backups, key rotation and scheduled jobs.
- `docs/SECURITY.md`: authorization and production limitations.
- `docs/TROUBLESHOOTING.md`: errors and recovery.
- `docs/RELEASE_REPORT.md`: executed tests and open release gates.

Completion as a reference application does not constitute police production approval.

Latest acceptance status and remaining real-browser/provider checks: [docs/ACCEPTANCE_STATUS.md](docs/ACCEPTANCE_STATUS.md).
