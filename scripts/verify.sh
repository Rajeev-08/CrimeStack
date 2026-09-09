#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../apps/api"
uv run ruff format --check src tests migrations
uv run ruff check src tests migrations
uv lock --check
uv run pytest -q
cd ../web
npm test -- --run
npm run build
npm run test:e2e
cd ../..
docker compose config --quiet
