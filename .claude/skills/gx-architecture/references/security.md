# Security baseline

## Threat model (10 minutes per feature)
For the feature, list: assets (data, money, accounts), actors (anonymous, user, other tenant's user,
admin, insider, compromised third party), entry points (endpoints, webhooks, uploads, imports,
realtime channels), and for each entry point ask STRIDE: Spoofing, Tampering, Repudiation (is it
audited?), Information disclosure, Denial of service, Elevation of privilege. Write mitigations into the plan.

## Authentication
- Use a proven provider (Supabase Auth, Auth0, Clerk, Cognito). Don't hand-roll password or OTP storage.
- OTP: short expiry, attempt limits, rate limit per phone and per IP, no OTP in logs, no fixed test OTP in production builds.
- Sessions: httpOnly, secure, sameSite cookies on web; secure storage (Keychain/Keystore) on mobile. Rotate refresh tokens; revoke on password/phone change and on logout-all.
- Admin and staff accounts: MFA required.

## Authorization
- Deny by default. Every endpoint/function checks: authenticated? which tenant? which role? owns this record?
- Enforce in the database too (RLS policies keyed on tenant and role) so a missed app check isn't a breach.
- Never trust ids, roles, prices or tenant ids from the client. Derive from the session and the DB.
- Test authorization negatively: for each endpoint, a test where another tenant's user tries and fails.

## Secrets
- In the platform's secret store or env vars on the server; never in git, never in client bundles
  (`NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, `VITE_*` are public by definition).
- Separate keys per environment. Rotate on staff exit and on any suspected leak. Pre-commit secret scanning (gitleaks/trufflehog) plus CI scanning.
- A leaked secret is rotated first, history-cleaned second. Cleaning history alone does nothing.

## Input and output
- Validate every input against a schema at the boundary (type, length, format, enum, range).
- Parameterised queries only. No string-built SQL, ever.
- Output-encode by context; avoid `dangerouslySetInnerHTML`; sanitise rich text with an allow-list.
- File uploads: allow-list types by content, size limits, no execution, private buckets.
- Spreadsheet export: neutralise formula injection (cells starting with `= + - @`).
- SSRF: never fetch a user-supplied URL server-side without an allow-list.

## Abuse and availability
Rate limits on auth, OTP, search, exports, and any expensive endpoint; per tenant and per IP.
Pagination limits. Request body size limits. Bot protection on public forms.

## Supply chain
Lockfiles committed, one package manager per app. Dependabot/Renovate. `npm audit`/`pip-audit` in CI
with a policy (block criticals). Pin GitHub Actions to SHAs. Review new dependencies: maintenance,
licence, size, permissions. Third-party skills/plugins for agents get the same review.

## AI features (if the product calls an LLM)
Treat model output as untrusted input. Never let model output choose SQL, URLs, or tool calls
without validation. Defend against prompt injection from documents/emails the model reads. Don't
send personal data to a model provider without a lawful basis and a DPA. Log prompts/outputs with PII
redaction. Rate-limit and cap cost per tenant.

## OWASP Top 10 quick map
Broken access control → authZ + RLS + negative tests · Cryptographic failures → TLS everywhere, managed
encryption at rest, no home-made crypto · Injection → parameterised queries, schemas · Insecure design →
threat model per feature · Misconfiguration → IaC, secure defaults, no debug in prod · Vulnerable
components → supply chain policy · Auth failures → provider + MFA + rate limits · Integrity failures →
signed webhooks, pinned CI · Logging failures → audit + alerting · SSRF → URL allow-lists.
