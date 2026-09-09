# Troubleshooting

| Symptom | Check and recovery |
|---|---|
| API startup fails | Run `uv sync --frozen`, inspect `.env`, then `uv run alembic upgrade head` from apps/api |
| Readiness returns 503 | Database must be reachable and migration revision must be 0002 |
| Bootstrap rejected | Use your configured secret; bootstrap is intentionally one-time. Existing deployments use Sign in |
| Session expires | Sign in again; unsaved UI state is not guaranteed to survive expiry |
| Import will not complete | Click Confirm import to see the missing-field explanation; enter the highlighted source/name. The button disables only during processing or when no rows are accepted |
| Missing occurrence/category | Use canonical fields or documented aliases; conflicting aliases are rejected |
| Map has no points | Inspect map-ready count; numeric lat/lon are required. Districts are never silently geocoded |
| Basemap is blank | External tiles may be blocked. Valid incident layers remain on the local canvas; WebGL must be supported |
| Copilot unsupported question | Use documented aggregate intents or configure the controlled provider. It is not a general-purpose chatbot |
| Copilot 502 | Provider unavailable/malformed routing; correct approved model/key or disable provider for rules mode |
| Model not ready | Upload at least 42 observed weeks and enough positives/negatives in all chronological splits |
| Model rejected | Its test Brier score did not beat the training-prevalence baseline; it cannot activate |
| Context correlation missing | Need five matching districts, positive population values and nonconstant indicators/rates |
| No notifications | Subscribe to dataset/event/priority; assignment notifications are targeted to the assignee |
| Stale record 409 | Refresh before editing; version checks prevent lost changes |
| Source retry exhausted | Fix the CSV; a changed input checksum is a new input. No unbounded retries |
| Scheduled source waiting | This is expected; schedules request manual authorized uploads |
| Brief signature fails | Check for modification and ensure the manifest's signing-key ID is still configured |
| Playwright port conflict | Stop local API/frontend before E2E; the suite creates its own temporary database |
| Browser package missing | Run `npx playwright install chromium`; Linux CI can use `--with-deps` |
| Docker not found | Install Docker/Compose on your machine; container gates cannot pass without it |

Do not relabel synthetic data official to remove a warning. Do not disable audit or role checks to work around an operational error.
