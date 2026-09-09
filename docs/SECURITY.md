# Security model and limitations

The API enforces ordered roles: viewer, analyst, supervisor, administrator. Viewers can inspect shared evidence and their own notifications, but cannot import or modify analytical workflows. Analysts create analytical records/tasks/briefs and submit their own investigations. Supervisors review investigations, activate validated models, reassign/escalate tasks, override SLA, control sources/schedules, and inspect audit history. Administrators also create users and establish bootstrap. Private notification and saved-view records are filtered by owner.

Passwords use Argon2id. Access tokens are signed HS256 with issuer/audience/expiry checks; their role is read from the database on every request. Frontend sessionStorage avoids persisting a token beyond the browser tab session; 401 responses clear it and display sign-in recovery. Sign-out clears the client token; this reference does not implement server-side revocation, refresh tokens, MFA, password reset, or enterprise SSO. Do not treat it as an audited identity platform.

A singleton bootstrap row protects one-time administrator creation against concurrent attempts. A configured secret is required. There is no hardcoded production administrator account. The shipped development secrets are deliberately marked unsafe. Production configuration rejects weak/example secrets and SQLite. Reverse-proxy HTTPS, HSTS, CSP appropriate to approved map hosts, perimeter rate limits, secret management, retention and monitored backups are deployment responsibilities. Login throttling is a per-process reference limiter, not a distributed production defense.

Audit writes serialize using a singleton head and hash canonical payload plus prior digest. Triggers prohibit ordinary UPDATE/DELETE of audit rows. Verification checks links, sequence and final head, including simple tail deletion. A database administrator could remove triggers and recompute the entire chain; external trusted checkpoints are required to detect that threat. No claim of cryptographic nonrepudiation is made.

Investigations use optimistic version checks and immutable approval snapshots. Brief manifests use SHA-256 and HMAC with versioned key IDs. HMAC integrity is shared-secret verification, not a public-key digital signature. Do not export secrets.

All registered users belong to one workspace. Dataset-level per-user entitlements, multi-tenant isolation, legal retention controls, advanced rate limiting, high-availability scheduler leasing, independent security review and a jurisdiction-specific privacy assessment are outside this reference release. Module JSON schemas use explicit validation but are not an exhaustive domain ontology. Treat uploaded evidence as sensitive and untrusted.

Network masking hides raw IDs and case references from viewers, using declared aliases. Masking is not anonymization and does not remove reidentification risk from relationship structure. Analysts/supervisors see authorized source identifiers.

Video analysis runs locally in the browser. File bytes and frames are never sent by the component. The exported report contains filename, checksum, numerical samples and motion event intervals. It does not identify people, infer intent, determine guilt or make enforcement decisions. Speech can use browser-vendor remote processing and is separately opt-in.

This application is not police production approval, a validated forecasting product, or a basis for arrests or individual risk scoring.
