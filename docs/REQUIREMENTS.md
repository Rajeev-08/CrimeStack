You are the lead software architect, senior full-stack engineer, ML engineer, UI/UX designer, security engineer, and QA engineer responsible for building a complete application called **CrimeStack — Crime Intelligence and Analytics Platform**.

Build the application from scratch as a production-quality reference implementation. Do not stop after creating the structure, mock screens, or partial functionality. Continue implementing, testing, debugging, and improving it until every required module and verification gate passes.

## 1. Product objective

Create a secure, professional crime-data intelligence platform that lets authorized analysts:

- Upload and validate incident datasets.
- Explore crime patterns through dashboards and maps.
- Detect trends, hotspots, anomalies, and early-warning signals.
- Ask evidence-grounded questions through an Intelligence Copilot.
- Examine authorized criminal-network data.
- Train and inspect aggregate risk models.
- Analyze district-level socio-economic indicators.
- Review authorized surveillance footage locally.
- Create investigation workspaces.
- Monitor data quality and schema drift.
- Assign operational tasks.
- Receive private notifications.
- Schedule controlled data-ingestion jobs.
- Generate governed intelligence briefs with integrity verification.

The application must never invent operational statistics or present synthetic data as real.

## 2. Required technology stack

Use this stack unless a compatibility issue requires a clearly documented alternative:

### Frontend

- React
- TypeScript
- Vite
- Modern CSS or a structured design-token system
- MapLibre GL JS
- Lucide icons
- Vitest and React Testing Library
- Playwright for end-to-end testing

### Backend

- Python 3.12
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- PostgreSQL with PostGIS for Docker deployment
- SQLite compatibility for local evaluation and automated tests
- Scikit-learn for aggregate models
- Pytest and Ruff

### Deployment

- Docker Compose
- Separate web, API, and database containers
- Nginx for the production frontend
- Environment-based configuration
- GitHub Actions CI

## 3. Repository structure

Create a clean monorepo:

```text
crimestack/
├── apps/
│   ├── api/
│   │   ├── migrations/
│   │   ├── src/crimestack/
│   │   │   ├── api/routes/
│   │   │   ├── services/
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── security.py
│   │   │   ├── audit.py
│   │   │   ├── config.py
│   │   │   ├── db.py
│   │   │   └── main.py
│   │   └── tests/
│   └── web/
│       ├── src/components/
│       ├── src/lib/
│       ├── src/styles/
│       └── tests/
├── data/
│   ├── examples/
│   ├── raw/
│   └── processed/
├── docs/
├── scripts/
├── .github/workflows/
├── docker-compose.yml
├── .env.example
└── README.md

```

Use database migrations from the beginning. Do not rely only on `create_all()` outside isolated tests.

## 4. Data strategy and provenance

Implement persistent provenance classifications:

- `uploaded_unverified`: structurally validated but not independently authenticated.
- `official_declared`: importer declares an official publisher, but the platform does not authenticate that claim.
- `synthetic_demo`: fictional demonstration data.
- `managed_source`: imported through a configured controlled source profile.

Display the selected dataset’s provenance prominently throughout the application.

A data-quality score must never be described as proof that data is genuine.

Include clearly labelled synthetic example datasets for:

- Geocoded Karnataka-style incidents.
- Long-duration incident data suitable for model testing.
- Criminal-network relationships.
- District socio-economic indicators.

Some example coordinates may correspond to real Karnataka locations, but all example crimes, entities, cases, and indicator values must be explicitly described as fictional.

Support these canonical incident fields:

```text
incident_id
occurred_at
reported_at
category
subcategory
description
severity
status
latitude
longitude
state_code
district_code
station_code
source_dataset_id

```

Accept useful aliases such as:

```text
id, case_number, date, datetime_occ, primary_type,
lat, lon, lng, district, police_station, beat

```

Require a recognizable occurrence timestamp and crime category. Coordinates remain optional.

Before import, show:

- Total rows.
- Accepted rows.
- Rejected rows.
- Duplicate rows.
- Map-ready rows.
- Quality score.
- Detected column mappings.
- Missing-field counts.
- First validation errors.
- Dataset name.
- Publisher/source label.
- Provenance classification.

A map-ready row must contain valid numeric latitude and longitude.

Never invent coordinates or silently geocode district names.

## 5. Authentication, authorization, and auditing

Implement:

- One-time administrator bootstrap.
- Secure password hashing.
- Signed expiring access tokens.
- Roles: viewer, analyst, supervisor, administrator.
- Permission checks at API level, not only in the UI.
- Viewer masking of sensitive network identifiers.
- Tamper-evident append-only audit chain.
- Audit-chain verification endpoint.
- Secure production configuration validation.
- Session-expiry handling in the frontend.

Permissions should follow least privilege.

## 6. Command Centre

Build a professional dashboard with:

- Total incidents in the active view.
- High-severity count.
- District coverage.
- Data-quality score.
- Date-range filtering.
- Category filtering.
- District filtering.
- Monthly trend chart.
- Severity distribution.
- Category distribution.
- District ranking and drill-down.
- Saved analytical views.
- Dataset comparison.
- Browser print/PDF report.
- Clear loading, empty, and error states.

All values must be calculated from the selected dataset. Do not hardcode demonstration totals.

## 7. Geospatial intelligence

Use MapLibre GL JS.

Implement:

- Heatmap mode.
- Cluster mode.
- Individual-point mode.
- Incident popups.
- Hotspot overlays.
- Severity legend.
- Automatic fitting to uploaded points.
- Correct behavior for a single point.
- Optional district-boundary GeoJSON.
- OpenStreetMap attribution.
- Configurable approved map-style URL.

The map must initialize from a local embedded style first. Load OpenStreetMap tiles separately so blocked external tiles do not prevent incident layers from appearing.

If tiles are unavailable, display uploaded points over a professional dark fallback canvas.

If the dataset has no usable coordinates, display:

> No usable coordinates in this view. The CSV needs numeric latitude/lat and longitude/lon/lng columns. District names are not silently geocoded.

Clearly distinguish:

- Real geographic basemap context.
- Uploaded incident coordinates.
- Optional district boundaries.
- Synthetic or unverified incident provenance.

Implement reproducible connected density-cell hotspot detection. Explain that hotspots summarize historical density and are not predictions of future crime.

## 8. Early Warning Centre

Implement deterministic weekly anomaly detection using:

- Latest weekly count.
- Four-week rolling baseline.
- Percentage increase.
- Anomaly score.
- Severity weighting.
- Confidence classification.
- Sensitive, standard, and conservative thresholds.
- Statewide, district, and category dimensions.

Each warning must expose its calculation and limitations.

Authorized users can mark warnings as:

- New.
- Investigating.
- Resolved.
- Dismissed.

Store review notes and audit all changes.

## 9. Intelligence Copilot

Build a fully functional evidence-grounded conversational assistant.

The Copilot must:

- Answer questions about totals, severity, districts, categories, trends, hotspots, warnings, network patterns, and active aggregate model signals.
- Preserve recent district/category context.
- Support English and Kannada.
- Return structured citations for every factual answer.
- Suggest supported follow-up questions.
- Export conversation history to PDF.
- Show explicit API, authentication, and unsupported-question errors.
- Return a cited zero-result response when combined conversational scope matches no records.

Never give the language model unrestricted SQL access.

Implement an allow-listed tool layer. If an LLM provider and API key are configured, it may convert natural language into those controlled tool calls. Validate every tool request server-side.

The application must remain fully usable without an external AI key through a tested deterministic intent router.

Clearly label the active mode:

- “AI tool-routing mode” when an approved provider is configured.
- “Rules-based evidence mode” when using deterministic fallback.

Add safety refusals for:

- Predicting who will commit a crime.
- Individual criminality scoring.
- Protected-attribute profiling.
- Guilt determination.
- Arrest recommendations.
- Unsupported enforcement decisions.

Test both the deterministic fallback and provider adapter with mocked provider responses.

## 10. Network Intelligence

Use a separate relationship-data schema.

Require:

- Explicit synthetic or authorized-data confirmation.
- Authorization basis.
- Stable entity aliases.
- Source and target entity types.
- Relationship type.
- Case reference.
- Optional date and confidence.

Implement:

- Interactive network graph.
- Search and filtering.
- Connected components.
- Repeat-case pattern detection.
- Entity inspector.
- Case counts and connection counts.
- Viewer masking.
- Copilot citations.

Do not infer relationships from ordinary incident records.

## 11. Aggregate Risk Model Registry

Only model district-category weekly aggregates.

Implement:

- Readiness checks.
- Chronological training, calibration, and test splits.
- Baseline comparison.
- Probability calibration.
- Brier score.
- Versioned model registry.
- Validation status.
- Explicit activation by supervisor/admin.
- Rejected-model state.
- Aggregate current signals.
- Additive factor explanations.
- Drift information.
- Model limitations.

Reject models that fail the documented holdout baseline.

Never perform person-level risk prediction.

## 12. Bilingual voice

Implement optional browser-based:

- English speech recognition using `en-IN`.
- Kannada speech recognition using `kn-IN`.
- Text-to-speech.
- Read-answer toggle.
- Clear unsupported-browser messages.
- Privacy notice explaining that CrimeStack does not store audio.

Voice must be an optional interface layer, not a requirement for Copilot functionality.

## 13. Surveillance Review

Implement authorized local-only video review.

Requirements:

- Explicit authorization confirmation.
- Process footage inside the browser.
- Do not upload footage or frames.
- Sample video frames.
- Measure explainable luminance/motion changes.
- Group motion events.
- Display event timeline.
- Export reproducible JSON report.

Explicitly exclude:

- Facial recognition.
- Person identification.
- Biometric matching.
- Intent inference.
- Automated enforcement decisions.

## 14. Socio-Economic Context Lab

Support provenance-bearing long-format district indicators:

```text
district_code
period
indicator_code
indicator_name
value
unit

```

Also require:

- Source name.
- Source URL.
- Licence/terms.
- Population indicator for per-capita rates.

Implement:

- District reconciliation.
- Unmatched-code reporting.
- Incident rates per 100,000.
- Spearman rank correlation.
- Minimum matched-district threshold.
- Scatterplot.
- Context/incident-period comparison.
- Clear non-causal interpretation.

Never feed socio-economic attributes into person-level profiling or enforcement recommendations.

## 15. Investigation Workspaces

Implement:

- Dataset-scoped investigations.
- Title, summary, status, scope, limitations, and hypotheses.
- Notes.
- Verification actions.
- Stable evidence references.
- Analyst submission.
- Supervisor approval/rejection.
- Approved-content freezing.
- SHA-256 snapshot.
- Print/PDF case brief.
- Full audit history.

## 16. Data Quality Centre

Implement stored quality assessments covering:

- Parse validity.
- Duplicate rate.
- Source-ID coverage.
- Timestamp coverage.
- Coordinate coverage.
- District and station coverage.
- Category distribution.
- Date window.
- Schema fingerprint.
- Column mappings.

Implement comparison between candidate and baseline datasets:

- Schema drift.
- Mapping changes.
- Category shifts.
- District shifts.
- Source-ID overlap.
- Date-window differences.
- Declared-source comparison.

Never automatically merge or delete evidence.

## 17. Operational Review Queue

Implement:

- Evidence-linked tasks.
- Task type.
- Priority.
- Owner.
- Status.
- Due date.
- SLA.
- Self-claiming.
- Supervisor reassignment.
- SLA override.
- Escalation.
- Comments/history.
- Filters and summary metrics.

Every task must point to a stable evidence reference.

## 18. Notification Centre

Implement private user subscriptions for:

- Assignment.
- Escalation.
- SLA events.
- Warning changes.
- Brief completion.

Support:

- Dataset scoping.
- Minimum priority.
- Deduplication.
- In-app inbox.
- Read receipts.
- Mark one/all as read.
- Audit trail.

## 19. Source Ingestion Operations

Implement controlled station-scoped source profiles:

- Source code and name.
- Station and district scope.
- Expected schema.
- Schedule.
- Enabled/disabled status.
- Bounded retries.
- Manual upload execution.
- Attempt history.
- Structured failure codes.
- Checksum duplicate prevention.
- Successful output dataset linkage.
- Complete lineage endpoint.

Do not implement arbitrary unauthenticated remote URL fetching.

## 20. Governed Briefing Centre

Implement:

- Brief schedules.
- Manual brief jobs.
- Reproducible JSON artifact.
- Selected dataset snapshot.
- Filters and metrics.
- Distributions and limitations.
- Provenance metadata.
- Artifact SHA-256.
- HMAC integrity manifest.
- Versioned signing-key identifiers.
- Integrity verification.
- Download endpoint.
- Scheduled-job deduplication.

Never include signing secrets in exports.

## 21. Professional UI requirements

Create a distinctive intelligence-workspace interface, not a generic admin template.

Visual direction:

- Deep navy and slate workspace.
- Teal operational highlights.
- Amber warnings.
- Coral critical states.
- Violet synthetic/demo labels.
- Manrope-style display typography.
- Highly readable body typography.
- Consistent spacing and design tokens.
- Soft gradients and controlled shadows.
- Clear information hierarchy.
- Responsive desktop, tablet, and mobile layouts.
- Accessible contrast.
- Keyboard-accessible controls.
- Visible focus states.
- Skeleton/loading states.
- Useful empty states.
- Error recovery messages.
- Print-friendly reports.

Navigation should include:

- Command Centre.
- Early Warnings.
- Intelligence Copilot.
- Network Intelligence.
- Risk Models.
- Surveillance Review.
- Socio-Economic Context.
- Investigations.
- Data Quality.
- Operations.
- Notifications.
- Source Ingestion.
- Briefing Centre.
- Security and Audit.
- Data Registry.

Do not use fake charts, hardcoded dashboard totals, decorative controls that do nothing, or buttons without implemented behavior.

## 22. Testing requirements

Testing is mandatory, not optional.

### Backend tests

Test:

- CSV aliases and validation.
- Duplicate detection.
- Coordinate validation.
- Provenance persistence.
- Authentication and permissions.
- Token expiry.
- Viewer masking.
- Audit-chain verification.
- Dashboard aggregations and filters.
- Hotspot detection.
- Early-warning calculations.
- Copilot intents, context, citations, empty scopes, Kannada, and refusals.
- Network validation and patterns.
- Model splits, rejection, calibration, activation, and signals.
- Context reconciliation and correlation.
- Investigation lifecycle.
- Quality snapshots and drift.
- Operational task permissions.
- Notification deduplication and receipts.
- Source-ingestion retries and lineage.
- Brief generation and integrity verification.
- Health and readiness endpoints.

### Frontend tests

Test:

- Authentication flows.
- API-client request contracts.
- Authorization header attachment.
- Dataset preview and provenance submission.
- Map-ready warnings.
- Loading, empty, and error states.
- Copilot conversation and request errors.
- Role-based navigation.
- Notification and operational interactions.
- Local surveillance calculations.
- Speech utility behavior.
- Application shell rendering.

### End-to-end tests

Use Playwright to test:

1. Bootstrap administrator.
2. Sign in.
3. Upload synthetic incident CSV.
4. Select synthetic provenance.
5. Confirm map-ready count.
6. Import dataset.
7. Verify dashboard metrics.
8. Verify map point rendering.
9. Change map modes.
10. Ask Copilot questions.
11. Verify citations.
12. Save a view.
13. Review an early warning.
14. Generate and verify a brief.
15. Sign out and sign back in.

Mock external tile and LLM services where appropriate. Core application tests must not depend on live third-party availability.

### Quality gates

The project is complete only when all of these pass:

```bash
cd apps/api
ruff format --check src tests migrations
ruff check src tests migrations
uv lock --check
pytest -q

cd ../web
npm test -- --run
npm run build

cd ../..
./scripts/verify.sh
docker compose config

```

Also test Alembic:

- Upgrade a clean database to head.
- Downgrade the latest migration.
- Upgrade again.
- Confirm existing dataset records receive safe provenance defaults.

## 23. Deployment and documentation

Provide:

- `.env.example`.
- Dockerfiles.
- Docker Compose.
- Nginx configuration.
- Health endpoint.
- Readiness endpoint.
- Startup scripts for Linux/macOS and Windows.
- Verification script.
- Deployment smoke-test script.
- GitHub Actions CI.
- Database migration instructions.
- Backup and restore instructions.
- Signing-key rotation instructions.
- Security limitations.
- Dataset documentation.
- Copilot documentation.
- Geospatial documentation.
- Complete run guide.
- Troubleshooting guide.

The Docker API container must run migrations before starting.

The frontend should proxy `/api`, `/health`, and `/ready` correctly.

## 24. Execution method

Work autonomously in this order:

1. Inspect the workspace and preserve unrelated user files.
2. Create a detailed implementation plan.
3. Build the foundation and database.
4. Implement authentication and audit controls.
5. Implement ingestion and provenance.
6. Implement dashboard and map.
7. Implement descriptive analytics and early warnings.
8. Implement Copilot.
9. Implement network and model features.
10. Implement voice, surveillance, and context.
11. Implement investigation and quality modules.
12. Implement operations, notifications, sources, and briefs.
13. Complete professional UI and responsive behavior.
14. Add all tests.
15. Run every verification command.
16. Fix every failure.
17. Run the full suite again.
18. Package the tested source as a versioned ZIP.
19. Provide exact run instructions and a completion report.

Do not repeatedly ask which feature to build next. Use sound engineering judgment and continue until the complete scope is implemented.

Do not claim completion while:

- Tests are failing.
- The production frontend does not compile.
- Database migrations fail.
- Buttons are placeholders.
- Dashboard values are hardcoded.
- Copilot errors silently.
- Maps fail when a third-party style endpoint is unavailable.
- Synthetic data is presented as official.
- Documentation does not match the implementation.

## 25. Final delivery format

When finished, provide:

- Final version number.
- Git commit and tag.
- Downloadable ZIP.
- Implemented-feature summary.
- Test counts and results.
- Known non-blocking warnings.
- Docker run commands.
- Non-Docker run commands.
- First-login instructions.
- Example dataset instructions.
- Clear explanation of which data is synthetic, uploaded, official-declared, managed, or external geographic context.
- Clear statement that completion as a reference application does not constitute police production approval.

Begin now. Build the actual application, not merely a proposal or design document.