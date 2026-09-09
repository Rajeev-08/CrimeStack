# Upgrade from 0.1.0

1. Stop both running terminals with Ctrl+C.
2. Back up `apps/api/crimestack.db` and `apps/api/.env` while the backend is stopped.
3. Extract this release into a new directory. Do not copy old `.venv` or `node_modules`.
4. To retain accounts/imports, copy your backed-up database and `.env` into the new `apps/api` directory.
5. Windows: double-click `RUN_WINDOWS.cmd`. Requires Python 3.12 with its Windows launcher and Node.js 22+. It creates a virtual environment, installs locked backend/frontend dependencies, migrates SQLite, checks API readiness and starts the UI. Keep the windows open.
6. Open http://127.0.0.1:5173. Sign in with your existing account. For a fresh database, create an administrator using the bootstrap secret from `.env`.
7. If old styling appears, press Ctrl+F5 once.

No schema change: Alembic remains at 0002. Existing approved records are not edited. Network records without dates display “Not supplied”. Updated synthetic network fixtures include fictional dates.

## Manual PowerShell setup

From the new `crimestack` directory:

```powershell
cd apps\api
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install uv
.\.venv\Scripts\uv.exe sync --frozen
if (!(Test-Path .env)) { Copy-Item ..\..\.env.example .env }
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn crimestack.main:app --host 127.0.0.1 --port 8000
```

Second terminal from `crimestack`:

```powershell
cd apps\web
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

The Windows launcher uses a process-scoped execution-policy option; it does not change the machine's persistent policy. It never deletes an existing database or overwrites `.env`. Windows execution has not been verified on this Linux build environment.
