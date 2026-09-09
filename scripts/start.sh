#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f apps/api/.env ]; then cp .env.example apps/api/.env; fi
cd apps/api
uv sync --frozen
uv run alembic upgrade head
uv run uvicorn crimestack.main:app --host 127.0.0.1 --port 8000 &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT INT TERM
cd ../web
npm ci
npm run dev -- --host 127.0.0.1
