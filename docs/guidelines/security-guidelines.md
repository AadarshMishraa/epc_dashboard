# Security guidelines

Status: Proposed. Binding for every task, human or agent. It builds on the kit baseline (`.claude/skills/gx-architecture/references/security.md`), the compliance register (`docs/compliance/register.md`) and ADR-0002 (tenancy) and ADR-0005 (AI connector). Where they differ, the stricter rule wins. This is engineering guidance, not legal advice.

## 1. Principles

1. **Deny by default.** No grant means no access. Unknown means no.
2. **Server decides.** The interface hides things for usability. Every call is authorized in the service layer, per tenant, per action, per resource.
3. **Isolation below the code.** Tenant separation is enforced by the database (forced row-level security), not by developers remembering a filter.
4. **Least privilege everywhere.** App role, service accounts, API keys, AI clients, background jobs, support staff.
5. **Evidence over trust.** Critical actions are audited in the same transaction; history is append-only and tamper-evident.
6. **Untrusted input stays untrusted.** Validate at every boundary; encode at every output; treat model output, file contents, headers, and webhook bodies as hostile.
7. **Secrets are never code.** They come through `SecretsProvider` and are never logged.
8. **Fail closed, say little.** Errors do not reveal tenants, accounts, internals or secrets.

## 2. Data classes

Every field has a classification (K4-T05 rejects fields without one). Classification drives masking, logging, export, retention and erasure.

| Class | Examples | Rules |
|---|---|---|
| Public | Product name, public pack docs | No restriction |
| Internal | Tenant settings, workflow definitions | Tenant-scoped, audited on change |
| Personal | Name, phone, email, address, location | Masked in logs and diffs; export and erase handlers required; consent where the register says so |
| Sensitive personal | Government identifiers, financial account details, health data, children's data | Avoid collecting; if unavoidable, encrypt at field level, mask in the interface, audited reveal, shortest retention |
| Secret | Passwords, tokens, API keys, signing keys | Never stored in plaintext, never logged, never in the interface after creation |

## 3. Secure development lifecycle (per task)

| Step | S1 | S2 | S3 |
|---|---|---|---|
| Threat model before build | - | 3 lines in the task description | STRIDE table by gx-security-reviewer, reviewed before code |
| Negative tests | where relevant | cross-tenant and unauthorised-caller tests | plus abuse, replay, fuzz or property tests named in the brief |
| Security review | at module gate | at module gate | blocks merge |
| Findings | Critical and High closed before merge | same | same, plus re-review after fix |

Security level (S1, S2, S3) is set per task in `docs/plans/TASKS.md`. S3 covers authentication, authorization, tenancy, crypto, secrets, untrusted ingress, audit integrity and erasure.

### STRIDE template (S3 tasks)

| Threat | Spoofing / Tampering / Repudiation / Information disclosure / Denial of service / Elevation | Asset | Control | Test that proves it |
|---|---|---|---|---|
| | | | | |

Rows are required for each trust boundary the task touches: browser to API, API to database, API to object storage, worker to broker, AI client to MCP gateway, tenant to tenant, operator to tenant.

## 4. Requirements by area

### 4.1 Tenancy (K1)
- Tenant context is mandatory and fails closed (`TENANT_REQUIRED`). No default tenant.
- Every tenant table: `tenant_id`, forced RLS, restrictive policy, composite foreign keys on `(tenant_id, id)`. App role is not the owner and has no `BYPASSRLS`. The tenant is set per transaction (`SET LOCAL`), never per session.
- Unknown, suspended and archived tenants receive the same generic response shape. Tenant names and counts never appear in errors, URLs of other tenants, or timing differences larger than 50 ms.
- Every new table and query path gets a cross-tenant negative test in the tenant matrix. The pool-leak test runs on every merge.
- Operator access to a tenant is a support session: reason, consent policy, hard expiry, read-only by default, every action audited.

### 4.2 Authentication and sessions (K2)
- Passwords follow NIST SP 800-63B-4: minimum 15 characters when it is the only factor, allow 64 or more, no composition rules, no forced rotation, screen against a breached-password list. Hash with a memory-hard function, versioned parameters, pepper from `SecretsProvider`, rehash on sign-in.
- Access tokens live 15 minutes. Refresh tokens rotate; reuse revokes the whole family. Cookies are `HttpOnly`, `Secure`, `SameSite=Lax` or stricter. No tokens in URLs or browser storage.
- MFA: TOTP and single-use hashed recovery codes. Sensitive actions need a second factor within the last 5 minutes (step-up).
- Rate limit and lock out every credential-bearing endpoint. Unknown and known accounts get the same status, body and timing (within 50 ms).
- Invitations and reset tokens are single-use, expiring and stored hashed.
- Compare secrets in constant time. Never log credentials, tokens, codes or hashes.

### 4.3 Authorization (K2)
- Permissions are declared only in module manifests. Roles are data. Unknown permission strings are rejected.
- Decisions: `can(subject, action, resource)` returns allow or deny with a reason code. The cache invalidates on role change within 5 seconds.
- No escalation: a subject cannot grant what it does not hold. The last admin cannot be removed. Role changes are audited.
- Row filters (own, team, branch, tenant) are applied in the data layer, not the interface.
- Every new module action ships with a negative test: caller without the permission is denied.

### 4.4 Service accounts, API keys and AI clients (K2, ADR-0005)
- Keys: scoped, expiring, hashed, shown once, rotatable, last-used tracked.
- OAuth for AI clients: authorization code with PKCE `S256` only, exact redirect URI matching, short-lived codes, audience-bound tokens, refresh rotation. Client metadata fetches use an allow-list, size and time caps and refuse private address ranges (SSRF).
- An AI client acts for a user and never exceeds that user's permissions. The audit actor records both. Tools are exposed per entitlement and permission.
- Model output is untrusted: never executed, never auto-submitted for sensitive actions, always validated against the tool's schema. Tool results returned to a model exclude secrets and respect masking.
- Prompt-injection stance: data from records, files and messages is data. It never changes tool permissions or instructions. Sensitive and destructive tools require explicit user confirmation.

### 4.5 Input, output and queries
- Validate every request, event, job and file at the boundary against a schema; reject unknown fields.
- Parameterized queries only. No string-built SQL. Dynamic identifiers come from allow-lists.
- Encode output for its context. No `innerHTML`. Rich text through an allow-list sanitizer.
- CSV and spreadsheet exports neutralise formulas: cells starting with `=`, `+`, `-` or `@` are prefixed.
- Outbound requests (webhooks, metadata, imports) use allow-lists, timeouts, size caps, no redirects to private ranges.

### 4.6 Files (K8)
- Private buckets, no public ACLs. Keys are generated and tenant-prefixed; user file names are metadata only.
- Limits and sniffing: size cap, allow-listed types, detected type must match declared type, path traversal rejected, archives not expanded server-side without limits.
- Downloads: permission check, then a signed URL valid 5 minutes. Never serve user content from the application origin.
- Malware scan with quarantine when enabled; quarantined files are not downloadable. Metadata stripping by policy. Sensitive downloads are logged.

### 4.7 Events, jobs and config (K6, K4, K5)
- Every event and job carries a tenant; workers restore context first and fail closed without it. Payloads exclude classified data unless the event type declares it.
- Handlers are idempotent. Poison messages go to the dead-letter queue; replay needs a permission and is audited.
- The expression language has a closed grammar with no I/O and limits on depth, size and steps. Expressions from tenants are validated at save and evaluated only in the sandbox.
- Config and bundles are schema-validated; a failed apply changes nothing; changes are versioned and audited.

### 4.8 Audit, logging and privacy (K7, K0)
- Audit rows are append-only, written in the same transaction, hash-chained per tenant, verified daily. Critical actions fail closed if the audit write fails.
- Logs are structured, carry correlation id and tenant, and mask personal data by classification. Never log secrets, tokens, full request bodies or file contents.
- Sensitive reads and downloads are logged. Bulk-read anomalies raise an event.
- Privacy duties are product features: consent with evidence, notices by version, request desk with clocks, retention, erasure and export handlers in every module that stores personal data, tenant exit, breach clocks of 6 hours and 72 hours (see `docs/compliance/breach-runbook.md`).

### 4.9 Secrets and configuration
- No secrets in git, images, build logs, front-end bundles or public environment variables. The secret scan blocks the build.
- Secrets are fetched at runtime through `SecretsProvider`, scoped per environment, rotated on a schedule and on suspected exposure.
- Separate credentials for development, staging and production. Local development uses throwaway values from example config files.

### 4.10 Supply chain and build
- Lockfiles committed; dependencies pinned; CI actions pinned by digest. Advisory scan fails the build on Critical and High.
- New dependencies need a reason in the pull request: maintenance status, licence, size, alternatives. Prefer the standard library and existing dependencies.
- Reproducible builds; artifacts signed when the deployment target supports it.

### 4.11 Interface (design system)
- Follow section 9 of `docs/design/design-system.md`: no inline handlers or styles, no secrets or personal data in browser storage or URLs, masked fields with audited reveal, destructive actions confirmed, 401 handled without leaking drafts into storage.
- Content Security Policy: `default-src 'self'`; `script-src 'self'`; `style-src 'self'`; `frame-ancestors 'none'`; `object-src 'none'`. Also set `X-Content-Type-Options: nosniff`, a strict `Referrer-Policy` and HSTS.

### 4.12 Transport, headers and cookies
- TLS 1.2 or higher everywhere, HSTS with preload once domains are stable. Internal service traffic is encrypted.
- CSRF protection on cookie-authenticated state changes. CORS is an allow-list per tenant domain, never `*` with credentials.

## 5. OWASP mapping

| Risk | Where it is handled |
|---|---|
| Broken access control | 4.1, 4.3; tenant matrix; negative tests per action |
| Cryptographic failures | 4.2, 4.9; field-level encryption for sensitive personal data |
| Injection | 4.5; expression sandbox 4.7 |
| Insecure design | STRIDE per S3 task; ADRs; extraction drill |
| Security misconfiguration | 4.11, 4.12; CI checks; secure defaults |
| Vulnerable components | 4.10 |
| Identification and authentication failures | 4.2 |
| Software and data integrity failures | 4.8 hash chain; 4.10 signed builds; config bundles verified |
| Logging and monitoring failures | 4.8; auth events; dead-letter and audit-chain alerts |
| Server-side request forgery | 4.4 metadata fetch; 4.5 outbound allow-lists |

## 6. Review gates

| Gate | When | Who | Pass criteria |
|---|---|---|---|
| Task | Every S3 task, before merge | gx-security-reviewer | STRIDE rows have controls and tests; 0 open Critical or High |
| Module | End of each module | gx-security-reviewer | S2 tasks reviewed; module baseline in `docs/plans` satisfied; tenant matrix covers every table |
| Milestone | Before each demo | gx-security-reviewer, Aadarsh | 0 open Critical or High in scope; dependency and secret scans clean |
| Launch | Before the first vertical goes live | external or counsel review recommended | Penetration test scope agreed, data-request drill 20 of 20, breach drill done |

Severity: **Critical** exploitable cross-tenant or unauthenticated access, secret exposure, or data loss; **High** privilege escalation, injection, auth bypass with preconditions; **Medium** hardening gaps; **Low** defence in depth.

## 7. Incidents

Follow `docs/compliance/breach-runbook.md`. For a suspected breach: open an incident in the incident log (K7-T15) so the 6-hour and 72-hour clocks start, contain, preserve evidence, notify per the runbook, and record the review. Rotate any exposed secret first.

## 8. Exceptions

An exception is written in `.claude/memory/DECISIONS.md` with the rule, the reason, the compensating control, an owner and an expiry date. Aadarsh approves. Exceptions to tenant isolation, audit integrity, secret handling or erasure are not granted.
