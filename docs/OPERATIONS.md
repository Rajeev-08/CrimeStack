# Operating the reference application

## Migrations

Local: from `apps/api`, run `uv run alembic upgrade head`. Inspect with `uv run alembic current`. In Docker, API startup runs migration before Uvicorn. Tests independently upgrade an empty database, insert a legacy dataset relying on the safe unverified default, upgrade, downgrade the latest revision, and upgrade again. Never downgrade a production database without a backup and reviewed migration plan.

## Backups and restores

PostgreSQL:

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backup.dump
# Stop writers before restoring into the intended database.
docker compose stop api web
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < backup.dump
docker compose start api web
```

These commands overwrite matching objects in the target database; use an isolated restore environment to verify a backup before any real restore. Secure backups as sensitive data.

SQLite: stop the API, copy `apps/api/crimestack.db` to a protected backup path. Restore that file while the API is stopped. For online backups use SQLite's backup API, not a blind copy of a live WAL database.

Back up signing keys separately under secure access control. Preserving the database without the historical signing keys prevents HMAC verification of older briefs. Keep the audit-head digest in an external protected checkpoint if you need to detect privileged rewriting of the entire database and chain.

## Signing-key rotation

1. Preserve the previous `SIGNING_KEY_ID` and secret in protected configuration.
2. Add the previous pair to `PREVIOUS_SIGNING_KEYS`, e.g. `{"v1":"<old-secret>"}`.
3. Set a new unique key ID (e.g. v2) and new independent random `SIGNING_SECRET`.
4. Restart the API. New artifacts use v2; old artifacts verify with the retained v1 key.
5. Remove old keys only after their artifact retention/verification requirements expire.

Exports contain key IDs, hashes and HMAC values, never secrets. Reproducibility means the same stored dataset/scope/signing key creates the same artifact envelope; job timestamps are not embedded in the artifact.

## Schedules and source operations

A background loop checks due work every `SCHEDULER_INTERVAL_SECONDS` (default 60). Disable with `SCHEDULER_ENABLED=false`. Supervisors can trigger `/api/scheduler/tick` manually. Brief jobs use unique schedule/timeslot dedupe keys. Source jobs create “awaiting manual upload” attempts: a human must provide the CSV through an enabled profile. The platform never fetches a configured arbitrary remote URL.

Source profiles specify station, district, canonical expected schema, enabled state, interval and maximum retries (0–3). Each execution validates every accepted row against station/district scope. Successful source/checksum pairs cannot be reimported. Failed identical uploads can be retried only within the profile's budget. A new checksum is a distinct input attempt. Attempt records retain structured error codes and successful output dataset IDs; lineage connects dataset, attempt and profile.

SLA notices are deduplicated by task/version/event/recipient. Recipients must subscribe to the matching dataset/event/priority. Assignment events target the assignee; dataset-wide warning and brief events target matching subscribers. In-app notifications are not email or SMS.

## Deployment smoke checks

`./scripts/smoke.sh http://localhost:8080` checks health, migration readiness and auth status through the frontend proxy. It does not exercise all analytical flows. Run the full Playwright/pytest suite and Docker startup gate separately.
