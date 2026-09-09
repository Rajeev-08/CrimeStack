# Architecture and implementation map

The API is the authorization boundary. React calls same-origin `/api` through Vite in development and Nginx in Docker. SQLAlchemy persists normalized incidents, datasets, users and audit entries. Versioned JSON module records retain workflow snapshots. Alembic creates the schema and audit-protection triggers; application startup does not call `create_all()`.

| Module | API/service | Behavior |
|---|---|---|
| Authentication | `/api/auth/*`, `/api/users` | One-time bootstrap, Argon2id, HS256 expiring tokens, roles |
| Registry | `/api/datasets`, `/preview` | UTF-8 CSV validation, aliases, duplicates, immutable imports |
| Command Centre | `/datasets/{id}/analytics` | Filters, metrics, distributions, trends, map features |
| Maps | `analytics.hotspots`, MapPanel | Local style, points, clusters, heatmap, optional polygons |
| Pattern discovery | `/datasets/{id}/patterns` | Day/hour distributions, aggregate segments, seeded Isolation Forest, evidence review steps |
| Warnings | `analytics.warnings`, warning_review records | Five-week comparison, thresholds, audited review history |
| Copilot | `/datasets/{id}/copilot` | Allow-listed tools, deterministic scope, validated provider output |
| Networks | network records, `/datasets/{id}/network` | Independent declared edges, components, repeat cases, viewer masking |
| Models | `/models/train`, `/models/{id}/activate` | Chronological splits, Platt calibration, Brier baseline, explicit activation |
| Context | context records | Long-format indicators, reconciliation, per-capita rates, Spearman |
| Investigations | investigation records | Notes, verifications, submit/review/freeze, SHA-256 |
| Quality | dataset quality, `/compare/{id}` | Persistent assessment and explicit comparisons |
| Operations | task records | Evidence references, optimistic version checks, claim/reassign/SLA |
| Notifications | subscription/notification records | Private inbox, dedupe, read receipts |
| Ingestion | source/attempt records, `/sources/{id}/execute` | Scope/schema checks, bounded retries, checksum dedupe, lineage |
| Briefs | `/datasets/{id}/briefs`, `/briefs/verify` | Reproducible snapshot, SHA-256, HMAC and key IDs |
| Scheduler | lifespan worker, `/scheduler/tick` | Due briefs, manual-upload waiting jobs, SLA notices |
| Audit | `/audit`, `/audit/verify` | Serialized hash chain with immutable rows and head check |

The default scheduler checks every 60 seconds. Its transaction uses an audit-head lock to serialize execution against manual ticks. It records actions under the workspace's first administrator; this is a reference-system choice, not an enterprise service-account implementation. Run one API process in the provided deployment.

Model signals are tied to the training dataset checksum. Importing new data creates a new dataset; it never silently mutates prior model evidence. Factors are additive calibrated log-odds, not causal explanations.

The selected dataset is immutable through the API. No evidence merge/delete endpoints exist. Record updates require the displayed version; stale updates return HTTP 409. Approved investigations reject all further edits. Notifications and saved views are owner-private; all other datasets/records are shared within this single authorized workspace. This is not a multi-tenant system.

## Stack deviations and constraints

- Map style URL support accepts approved raster layers from a MapLibre v8 style; arbitrary vector-label styles are not supported. Incident layers always use the embedded local style.
- PostgreSQL uses a PostGIS image, but density computation is deterministic Python grid processing, not a PostGIS spatial query. SQLite and PostgreSQL share ordinary numeric coordinate columns.
- Print/PDF uses the browser print dialog, not a server PDF renderer.
- Server modules use a shared versioned record table with validated service boundaries rather than one table per workflow.
- Display typography uses a Manrope-first local font stack; no font CDN is required.
- Network graphs use keyboard-accessible SVG nodes on a fixed radial layout. They support search, relationship/component filtering, multiple-case filters and dated case inspection. Graph display is capped at 80 filtered nodes; the table retains all matches. This is not force simulation or drag placement.
- Data transfers and aggregate computation are bounded for a reference workspace; this is not a large-volume streaming system.
