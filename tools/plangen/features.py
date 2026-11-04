"""Feature catalogue for the foundation (kernel L0) and the design system.

Source for docs/prd/01-prd.md, 02-roadmap.md, STATUS.md and the task register.
Edit here, then run: python3 tools/plangen/gen.py
Each feature: id, name, one line, priority, needs (N-ids), tasks (plan ids), acceptance criteria (Given, When, Then).
Priority: Must = needed before the first vertical can run on it; Should = v1; Later = v2.
"""

F = []


def feat(fid, name, line, pri, needs, tasks, acs=()):
    F.append(dict(id=fid, name=name, line=line, pri=pri, needs=needs, tasks=tasks, acs=list(acs)))


# ---------------------------------------------------------------- K0 core and toolchain (milestone M-01)
feat("F-01", "Stack decision, workspace and local environment",
     "Decide the stack, lay out one package per module and start everything locally with one command.",
     "Must", ["N-03"], ["K0-T01", "K0-T02", "K0-T11"], [
     ("a fresh clone", "the one-command environment script runs",
      "the database, object-storage emulator and mail sink are running and seeded in under 5 minutes"),
     ("the workspace", "the build runs",
      "all 10 packages compile and each exposes exactly 1 public-API file"),
     ("ADR-0006 is accepted", "a reviewer opens it",
      "it names language, framework, Postgres version, queue approach, package manager and repo layout, 6 of 6 decided")])
feat("F-02", "Core contracts, ports and redacted logging",
     "Context, ids, errors, the nine core ports with in-memory fakes and structured logging with redaction.",
     "Must", ["N-03"], ["K0-T03", "K0-T14", "K0-T04"], [
     ("a request, job or event", "code runs", "the context carries tenant, actor and correlation id on 100% of 50 sampled log lines"),
     ("the 9 core ports", "their contract suites run against the fakes", "9 of 9 suites pass"),
     ("a log line containing a phone number, an email and an ID pattern", "it is written", "all 3 patterns are masked")])
feat("F-03", "Migration framework and test kit",
     "Package-namespaced forward-only migrations, tenant matrix runner, contract harness and frozen clock.",
     "Must", ["N-03", "N-01"], ["K0-T05", "K0-T06"], [
     ("2 packages with migrations", "both run on an empty database", "they apply in dependency order in 1 pass and the ledger lists each once"),
     ("a migration that drops a column the previous release reads", "the migrate-from-previous check runs", "the build exits with code 1"),
     ("a table with a tenant column", "the tenant matrix runner reads, writes and deletes as tenant A against tenant B rows", "all 3 operations affect 0 rows"),
     ("a frozen clock", "a test advances 24 hours", "time-based code sees exactly 24 hours elapse")])
feat("F-04", "Manifest, boundary and API gates",
     "Manifest validator, import and table-ownership lint, industry-word lint and a public-API semver gate.",
     "Must", ["N-03", "N-02"], ["K0-T07", "K0-T08", "K0-T09"], [
     ("a manifest with an unknown key", "the validator runs", "it exits non-zero and names the key"),
     ("a foundation package importing a vertical package", "the boundary lint runs", "it exits with code 1 and prints 1 offending import path"),
     ("a foundation file containing an industry word", "the lint runs", "it reports 1 violation with file and line"),
     ("a removed public export without a major version bump", "the API diff runs", "the gate exits with code 1")])
feat("F-05", "CI pipeline with security gates",
     "One pipeline that runs lint, tests, tenant matrix, migration check, boundary lint, privacy check, secret scan and dependency scan.",
     "Must", ["N-03"], ["K0-T10"], [
     ("a pull request", "CI runs", "9 stages run: lint, unit, contract, tenant matrix, migrate-from-previous, boundary lint, privacycheck, secret scan, dependency scan"),
     ("a dependency with a known critical advisory", "the scan runs", "the build exits with code 1 and names the package"),
     ("a committed string matching a secret pattern", "the secret scan runs", "the build exits with code 1"),
     ("a typical pull request", "the full pipeline runs", "it finishes in under 15 minutes")])
feat("F-06", "Sandbox host and observability baseline",
     "A composition root that boots from the foundation alone and lists what is registered, with metrics, tracing hooks and health probes; used for the extraction drill.",
     "Must", ["N-03", "N-02"], ["K0-T12", "K0-T13"], [
     ("the sandbox host", "liveness and readiness are probed", "liveness returns 200 and readiness reports 0 failing dependencies"),
     ("only the foundation packages", "the sandbox boots", "health returns ok and every installed package is listed"),
     ("a throwaway module declared by manifest only", "it is added to the sandbox", "it appears in the registered list with 0 foundation files changed"),
     ("an empty database", "the host starts", "migrations apply and the process reports ready in under 30 seconds")])

# ---------------------------------------------------------------- K1 tenancy (M-02)
feat("F-07", "Tenant lifecycle and typed settings",
     "Provision, suspend, reactivate, archive and schedule deletion; typed tenant settings; demo tenants.",
     "Must", ["N-01"], ["K1-T01", "K1-T07", "K1-T09", "K1-T12"], [
     ("a new tenant request", "provisioning runs", "the tenant, default settings and default roles exist after 1 transaction and tenant.created is emitted once"),
     ("an active tenant", "it is suspended", "every API call for it returns 403 within 60 seconds and tenant.suspended is emitted once"),
     ("a tenant", "settings are read", "region, timezone, currency, locale, fiscal-year start and branding tokens return as typed values, 6 of 6 present"),
     ("a demo tenant", "reset runs twice", "both runs yield identical row counts across all tables")])
feat("F-08", "Fail-closed tenant isolation",
     "Mandatory tenant context and database row-level security so a forgotten filter cannot leak data.",
     "Must", ["N-01"], ["K1-T02", "K1-T03", "K1-T04"], [
     ("a query with no tenant context", "it runs", "it is rejected with error code TENANT_REQUIRED and returns 0 rows"),
     ("a tenant table created by the helper", "tenant A reads, updates and deletes", "0 of tenant B's rows are visible or changed"),
     ("200 concurrent requests across 20 tenants on a pool of 10 connections", "the pool-leak test runs", "0 requests observe another tenant's setting"),
     ("the application database role", "its privileges are inspected", "it is not the table owner and has no BYPASSRLS, 2 of 2 checks pass")])
feat("F-09", "Tenant resolution",
     "Resolve the tenant from subdomain, custom domain or token claim, with a generic response for unknown tenants.",
     "Must", ["N-01"], ["K1-T05"], [
     ("a request on a registered subdomain", "it is resolved with a warm cache", "the tenant id returns in under 5 ms"),
     ("an unknown host", "it is resolved", "the response is a generic 404 identical to 1 reference body and discloses 0 tenant names"),
     ("a token claim and a host that name different tenants", "the request arrives", "it is rejected with 403 and 1 audit event is written")])
feat("F-10", "Organisation units and scope",
     "Company, branch and team hierarchy with own, team, branch and tenant scope resolution.",
     "Must", ["N-06"], ["K1-T08"], [
     ("a company with 3 branches and 5 teams", "scope branch is resolved for a user", "only that branch and its teams are returned"),
     ("a user with scope own", "records are listed", "only records they own return and 0 others"),
     ("a branch moved to another company", "scope is resolved on the next request", "the new hierarchy applies and 0 stale grants remain")])
feat("F-11", "Quota and rate-limit enforcement points",
     "Places in the request path where limits from the entitlement module are enforced.",
     "Must", ["N-01"], ["K1-T10"], [
     ("a tenant with a limit of 100 requests per minute", "101 requests arrive in 60 seconds", "request 101 returns 429 with a retry-after value"),
     ("a quota provider fake that denies", "an action runs", "the action is blocked with 1 reason that names the limit key"),
     ("2 tenants where one exceeds its limit", "both send traffic", "the other tenant's p95 latency stays within 10% of its baseline")])
feat("F-12", "Silo routing",
     "Route a tenant to a dedicated database or region by configuration only.",
     "Later", ["N-19"], ["K1-T06"])
feat("F-13", "Support access sessions",
     "Time-boxed, reasoned, consented and audited access for platform support staff.",
     "Should", ["N-14"], ["K1-T11"])

# ---------------------------------------------------------------- K6 events and jobs (M-03)
feat("F-14", "Event envelope and transactional outbox",
     "A versioned event envelope written in the same transaction as the state change.",
     "Must", ["N-04"], ["K6-T01", "K6-T02"], [
     ("a state change and an event in 1 transaction", "the transaction rolls back", "0 outbox rows exist"),
     ("an event type whose required field changed", "the compatibility check runs", "CI exits with code 1 unless the version number increases by 1"),
     ("an envelope without a tenant", "it is published", "it is rejected with 1 error code")])
feat("F-15", "Dispatch, subscriptions, retries and dead letters",
     "At-least-once delivery, idempotent consumers, backoff with jitter, dead-letter queue and replay.",
     "Must", ["N-04"], ["K6-T03", "K6-T04", "K6-T05", "K6-T09"], [
     ("4 workers and 10,000 events", "all events are dispatched", "every event takes effect exactly once and per-entity order holds"),
     ("a handler that fails 3 times then succeeds", "it is retried", "it succeeds on attempt 4 with increasing delays and jitter"),
     ("a poison event", "it exceeds the configured 8 attempts", "it lands in the dead-letter queue and 1 replay command re-queues it"),
     ("the same event delivered twice", "the consumer runs", "the processed-event table makes the second run a no-op")])
feat("F-16", "Job queue and tenant fairness",
     "Jobs with tenant context, priority, delay, timeout, cancel, concurrency caps and fair scheduling across tenants.",
     "Must", ["N-04"], ["K6-T06", "K6-T07"], [
     ("a job enqueued with tenant context", "a worker runs it", "the worker restores that tenant and 0 queries run without it"),
     ("tenant A queues 10,000 jobs and tenant B queues 10", "workers run", "B's jobs start within 30 seconds"),
     ("a job past its 60-second timeout", "the timeout fires", "the job is cancelled and marked failed 1 time")])
feat("F-17", "Tenant-aware scheduler",
     "Cron and one-off schedules in the tenant's timezone with single-fire and a missed-run policy.",
     "Must", ["N-04"], ["K6-T08"], [
     ("a daily 09:00 schedule for a tenant in Asia/Kolkata", "it fires", "it runs once at 09:00 local time"),
     ("3 scheduler instances", "a tick occurs", "exactly 1 instance fires the job"),
     ("a 2-hour outage", "service resumes", "the configured missed-run policy applies: 1 catch-up run or 0")])
feat("F-18", "Event operations and chaos tests",
     "Lag, depth, retry and dead-letter metrics with alerts, plus kill, skew and poison soak tests.",
     "Must", ["N-04"], ["K6-T10", "K6-T11"], [
     ("a dispatcher killed mid-batch 1,000 times", "the soak test ends", "0 events are lost and 0 take effect twice"),
     ("a dead-letter queue above 100 entries", "the metric is evaluated", "an alert fires within 5 minutes"),
     ("a clock skew of 5 minutes", "the scheduler runs", "no job fires twice")])

# ---------------------------------------------------------------- K7a audit (M-03)
feat("F-19", "Audit trail core",
     "Append-only audit written in the same transaction, actor model including AI clients, masked diffs and a fail-closed policy.",
     "Must", ["N-05"], ["K7-T01", "K7-T02", "K7-T03", "K7-T05"], [
     ("a state change", "the transaction commits", "1 audit row exists with actor, action, entity, tenant and correlation id"),
     ("a configured entity with a classified field", "the field changes", "the stored diff holds that field masked and 0 raw values"),
     ("a critical action and a failing audit write", "the action runs", "the action fails and 0 state changes persist"),
     ("an AI client acting for a user", "it performs an action", "the audit actor records 2 identities: the user and the client")])
feat("F-20", "Tamper-evident audit chain",
     "Per-tenant hash chain with a verifier job that detects alteration.",
     "Must", ["N-05"], ["K7-T04"], [
     ("10,000 audit rows", "the verifier runs", "it reports 0 breaks"),
     ("1 row altered directly in the database", "the verifier runs", "it names the first broken row"),
     ("the verifier finds a break", "the daily job completes", "an alert is raised within 5 minutes")])
feat("F-21", "Sensitive-read logging and audit query",
     "Log reads of classified data and downloads; query and export the audit trail with permission checks.",
     "Must", ["N-05"], ["K7-T06", "K7-T07"], [
     ("a read of a classified field", "it executes", "1 sensitive-read audit row is written"),
     ("a user without the audit.read permission", "they query the audit log", "they receive 403 and 0 rows"),
     ("an export of 100,000 audit rows", "it is requested", "it streams in batches of 1,000 and every cell starting with =, +, - or @ is neutralised")])
feat("F-22", "Audit retention and archive",
     "Monthly partitions, retention of at least 1 year, legal hold and archive.",
     "Should", ["N-05"], ["K7-T08"])

# ---------------------------------------------------------------- K4 config (M-04)
feat("F-23", "Scoped configuration with versions",
     "Typed config with default, pack, tenant, branch and user scopes; versioned, audited and reversible.",
     "Must", ["N-07"], ["K4-T01", "K4-T02"], [
     ("a key set at default, pack, tenant and user levels", "it is resolved for a user", "the most specific level wins, 4 of 4 precedence cases pass"),
     ("a config change", "it is saved", "version n+1 exists with author and time and 1 event is emitted"),
     ("a rollback to version n-1", "it is applied", "values match that version exactly and 1 new audited version is created")])
feat("F-24", "Labels and lookup lists",
     "Tenant-editable vocabulary with locale fallback and managed enumerations.",
     "Must", ["N-07"], ["K4-T03", "K4-T04"], [
     ("a missing label in locale hi", "it is rendered", "it falls back to en and 1 missing-key report row is recorded"),
     ("a lookup value used by existing records", "it is deactivated", "0 existing records change and 0 new records can select it"),
     ("a lookup list of 50 values", "it is reordered", "the next read returns the new order for all users")])
feat("F-25", "Custom fields",
     "Tenant-defined fields with validation, classification, lifecycle rules and write-time checking.",
     "Must", ["N-07", "N-02"], ["K4-T05", "K4-T06", "K4-T11"], [
     ("a numeric field with a range of 0 to 100", "a value of 101 is written", "the write fails with 1 field-level error"),
     ("a field defined without a data classification", "it is saved", "it is rejected with 1 validation error"),
     ("a field that already holds data", "its type is changed", "the change is refused with 1 error code"),
     ("50 custom fields on 1 entity", "a record is read", "p95 read time stays within 20% of the same entity with 0 custom fields")])
feat("F-26", "Custom field indexing and filtering",
     "A capped registry of indexed fields with a filter and sort interface.",
     "Should", ["N-07"], ["K4-T07"])
feat("F-27", "Condition language",
     "A closed, sandboxed, versioned expression language used by guards, flags, permissions and computed fields.",
     "Must", ["N-07", "N-02"], ["K4-T08"], [
     ("a hostile expression nested 10,000 levels deep", "it is evaluated", "it is rejected in under 50 ms with no stack overflow"),
     ("an expression calling an undefined function", "it is validated", "it fails with 1 error naming the function"),
     ("the grammar", "it is reviewed", "it contains 0 functions for file, network or clock access and the same inputs give identical results across 1,000 runs")])
feat("F-28", "Computed fields and form layouts",
     "Computed fields with dependency order and cycle detection; form layouts as data with visibility rules.",
     "Should", ["N-07"], ["K4-T09", "K4-T10"])
feat("F-29", "Configuration bundles",
     "Import and export of config with dry run, idempotent re-apply and version pinning.",
     "Must", ["N-02"], ["K4-T12"], [
     ("a bundle", "it is applied twice", "the second apply changes 0 rows"),
     ("a dry run", "it is requested", "the diff lists every create, update and delete before anything is written"),
     ("a bundle pinned to version 2", "it is applied to a tenant on version 3", "it is rejected with a version-conflict error")])

# ---------------------------------------------------------------- K2 identity (M-05)
feat("F-30", "Identity and credentials",
     "Global user with per-tenant membership, memory-hard password hashing and a password policy aligned to NIST SP 800-63B-4.",
     "Must", ["N-09"], ["K2-T01", "K2-T02", "K2-T03"], [
     ("1 person in 3 tenants", "they sign in", "1 global user and 3 memberships exist"),
     ("passwords of 15 and 64 characters not on the blocklist", "they are set", "both are accepted and no composition rule is applied"),
     ("a stored hash with old parameters", "the user signs in", "it is rehashed on that 1 sign-in and the stored parameter version equals the current version"),
     ("a password on the blocklist", "it is set", "it is rejected with 1 stated reason")])
feat("F-31", "Sign-in and sessions",
     "Built-in provider, short access tokens, rotating refresh tokens with reuse detection, device list and revoke.",
     "Must", ["N-09"], ["K2-T04", "K2-T05"], [
     ("an access token lifetime of 15 minutes", "a token is used at minute 16", "it is rejected with 401"),
     ("a refresh token used twice", "the second use arrives", "the whole token family is revoked and 1 security event is raised"),
     ("a user with 3 devices", "1 is revoked", "its next refresh fails and the other 2 continue"),
     ("a session idle past the idle timeout", "any request arrives", "the response is 401 and 1 new sign-in is required")])
feat("F-32", "Multi-factor authentication and step-up",
     "TOTP, recovery codes and a step-up check for sensitive actions.",
     "Must", ["N-09"], ["K2-T06"], [
     ("a TOTP enrolment", "a valid code is entered", "10 single-use recovery codes are issued once"),
     ("a sensitive action marked step-up", "it is performed without a second factor in the last 5 minutes", "it is refused with a step-up challenge"),
     ("5 wrong codes in 10 minutes", "another code is tried", "the attempt is rate limited and 1 anomaly event is raised")])
feat("F-33", "Invitations, recovery and abuse protection",
     "Single-use expiring invitations, reset flow, lockout and uniform responses that do not reveal accounts.",
     "Must", ["N-09"], ["K2-T07", "K2-T08"], [
     ("an invitation with a 7-day expiry", "it is used on day 8", "it fails, and an invitation used once on day 2 fails on second use"),
     ("a reset request for a known email and one for an unknown email", "both are submitted", "status and body are identical and response times differ by under 50 ms"),
     ("10 failed sign-ins in 15 minutes", "the next one arrives", "the account is slowed or locked per policy and 1 anomaly event is raised")])
feat("F-34", "Roles and permission engine",
     "Permissions declared by modules, roles as data, deny-by-default decisions with reasons and escalation guards.",
     "Must", ["N-06"], ["K2-T09", "K2-T10", "K2-T12", "K2-T18"], [
     ("a user with no grant", "they call any action", "the decision is deny with 1 reason code"),
     ("a role change", "it is saved", "cached decisions for that user are invalidated within 5 seconds"),
     ("a user who can edit roles", "they grant a permission they do not hold", "it is refused and the 500-case escalation property test finds 0 paths"),
     ("the last remaining admin", "they are demoted or removed", "the change is refused and 1 admin remains")])
feat("F-35", "Attribute conditions on permissions",
     "Amount caps and discount limits expressed with the condition language.",
     "Should", ["N-06"], ["K2-T11"])
feat("F-36", "Service accounts and API keys",
     "Scoped, hashed, show-once keys with rotation, expiry and last-used tracking.",
     "Must", ["N-11"], ["K2-T13"], [
     ("a newly created key", "it is displayed", "it is shown once and 0 plaintext copies exist in the database"),
     ("a key scoped to read orders", "it calls a write action", "the result is 403"),
     ("a key past its expiry", "it is used", "the result is 401 and the failed attempt is logged")])
feat("F-37", "Single sign-on with OIDC",
     "OIDC adapter and claim-to-role mapping, gated by the entitlement check.",
     "Later", ["N-15"], ["K2-T14"])
feat("F-38", "OAuth for AI clients",
     "Authorization code with PKCE S256, client registration, discovery metadata and conformance checks for Claude and ChatGPT connectors.",
     "Must", ["N-11"], ["K2-T15", "K2-T16"], [
     ("the Claude connector", "it registers and runs authorization code with PKCE S256", "it receives tokens scoped to the signed-in user and 1 conformance check passes"),
     ("the ChatGPT connector", "it runs the same flow", "1 conformance check passes"),
     ("an authorization request with PKCE method plain", "it is sent", "it is rejected with a 400 error"),
     ("an AI client token", "it calls a tool the user may not use", "the result is 403 and the audit actor shows the user and the client")])
feat("F-39", "Authentication events and anomaly signals",
     "Events for failures and new devices that other modules can subscribe to.",
     "Should", ["N-09"], ["K2-T17"])

# ---------------------------------------------------------------- K3 entitlements (M-06)
feat("F-40", "Module registry and per-tenant enablement",
     "Installed modules and versions with a dependency check at boot; one check enables or hides a module for a tenant.",
     "Must", ["N-08"], ["K3-T01", "K3-T02"], [
     ("a module whose dependency is missing", "the host boots", "boot exits with code 1 and lists 1 missing module"),
     ("a module disabled for a tenant", "its route, navigation entry, AI tool and job are invoked", "all 4 are refused through the same single check"),
     ("an enablement change", "it is saved", "it takes effect within 60 seconds")])
feat("F-41", "Plans, entitlements and usage metering",
     "Boolean, limit and metered entitlements with overrides, an admin interface and idempotent usage records.",
     "Must", ["N-08"], ["K3-T03", "K3-T04", "K3-T05", "K3-T11"], [
     ("a plan with a limit of 5 users", "a 6th user is invited", "it is refused and the response names the limit key"),
     ("a per-tenant override with an expiry date", "the date passes", "the plan value applies again within 5 minutes"),
     ("a usage record submitted twice with the same idempotency key", "both are processed", "usage increases by 1, not 2"),
     ("an entitlement store outage", "a security-relevant limit is checked", "the check returns deny for 100% of security-relevant keys")])
feat("F-42", "Feature flags",
     "Tenant list, percentage and attribute rules with a kill switch.",
     "Should", ["N-08"], ["K3-T06"])
feat("F-43", "Trial, expiry and subscription lifecycle",
     "Trial, expiry and grace with read-only degradation; a subscription provider port with a stub.",
     "Should", ["N-18"], ["K3-T07", "K3-T08"])
feat("F-44", "Signed licence file",
     "Offline-verifiable licence for dedicated and custom deployments.",
     "Later", ["N-18"], ["K3-T09"])
feat("F-45", "Pack pinning and upgrades",
     "Pin a tenant to a pack version and upgrade with dry run and rollback.",
     "Later", ["N-02", "N-08"], ["K3-T10"])

# ---------------------------------------------------------------- K5 workflow (M-06)
feat("F-46", "Workflow definitions and instances",
     "Versioned state machines attached to any entity, with optimistic concurrency, history and why-blocked answers.",
     "Must", ["N-10"], ["K5-T01", "K5-T02", "K5-T08"], [
     ("a published workflow version", "it is edited", "a new version is created and the published one is unchanged"),
     ("2 concurrent transitions on the same instance", "both are submitted", "exactly 1 succeeds and 1 receives a conflict error"),
     ("a completed transition", "history is read", "it records 4 fields: actor, from-state, to-state and time")])
feat("F-47", "Guards, stage requirements, actions and explanations",
     "Declarative and named guards, required fields and documents per stage, an action registry with a loop guard, and read interfaces that explain why a record is blocked.",
     "Must", ["N-10"], ["K5-T03", "K5-T04", "K5-T05", "K5-T11"], [
     ("a blocked instance", "why-blocked is requested", "it names each failing guard, 100% of them"),
     ("a transition guarded by amount at most 100000", "an amount of 100001 is submitted", "it is refused and the guard is named"),
     ("a stage that requires 2 documents", "1 is attached and a transition is attempted", "the transition is refused"),
     ("an action that triggers the same transition again", "it runs", "the loop guard stops it after at most 10 hops")])
feat("F-48", "SLA timers and stuck-instance sweeper",
     "Business-calendar timers with pause and resume, breach events, escalation and a sweeper.",
     "Must", ["N-10"], ["K5-T06", "K5-T13"], [
     ("a 2-business-day SLA on a Monday to Friday calendar", "it starts Friday 17:00", "the breach time is Tuesday 17:00"),
     ("a paused instance", "it is resumed", "the remaining time differs by 0 minutes from the value at pause"),
     ("an instance with no activity for 30 days", "the sweeper runs", "it is reported as stuck exactly once")])
feat("F-49", "Approvals",
     "Multi-step any-of and all-of approvals with delegation and expiry.",
     "Must", ["N-10"], ["K5-T07"], [
     ("a 2-step approval where step 1 needs any of 3 approvers", "1 approves", "step 1 completes and step 2 starts"),
     ("an approver with a delegate", "a request arrives", "1 delegate notification is sent and the audit shows 2 people"),
     ("an approval with a 3-day expiry", "it expires", "the configured outcome, escalate or reject, happens once")])
feat("F-50", "Workflow tooling",
     "Definition validator, dry-run simulator, version migration of running instances and pack templates.",
     "Should", ["N-10"], ["K5-T09", "K5-T10", "K5-T12"])

# ---------------------------------------------------------------- K7b privacy desk (M-07)
feat("F-51", "Notices and consent",
     "Versioned notices per purpose and language; grant, withdraw and check consent with evidence.",
     "Must", ["N-12"], ["K7-T09", "K7-T10"], [
     ("a granted consent", "it is checked", "it returns 3 evidence fields: notice version, language and timestamp"),
     ("a withdrawn consent", "processing for that purpose checks it", "it returns false from the very next check with 0 stale grants"),
     ("a new notice version", "it is published", "0 existing consents are silently upgraded")])
feat("F-52", "Data-request desk",
     "Access, correction, erasure, grievance and nominee requests run as workflows with SLA timers.",
     "Must", ["N-12"], ["K7-T11"], [
     ("an erasure request", "it is opened", "1 workflow instance with the configured SLA starts and is routed to 1 tenant admin"),
     ("the 5 request types", "templates are listed", "5 of 5 have a workflow template"),
     ("a request at 80% of its SLA", "the timer fires", "1 reminder event is emitted")])
feat("F-53", "Retention engine",
     "Retention policy per data class with scheduled delete or anonymise, advance notice and legal hold.",
     "Must", ["N-12"], ["K7-T12"], [
     ("a retention policy of 24 months for a data class", "records age beyond it", "they are deleted or anonymised by the next scheduled run"),
     ("a legal hold on a record", "retention runs", "the record is skipped and 1 skip is logged"),
     ("an advance-notice setting of 7 days", "a record nears deletion", "1 notice event is emitted 7 days before")])
feat("F-54", "Erasure, export and tenant exit",
     "Eraser and exporter orchestration with statutory-hold exceptions; full tenant export then deletion.",
     "Must", ["N-12"], ["K7-T13", "K7-T14"], [
     ("a seeded person with data in 5 modules", "erasure runs", "5 of 5 handlers run and any statutory-hold exception is recorded"),
     ("a tenant exit", "the export runs", "it contains 100% of tables that have exporter handlers, with a checksum"),
     ("a completed tenant deletion", "it is verified", "0 rows remain for the tenant and 1 deletion record remains")])
feat("F-55", "Incident log and breach clocks",
     "Incident register with 6-hour and 72-hour clocks and a response checklist.",
     "Must", ["N-12"], ["K7-T15"], [
     ("an incident marked as a personal-data breach", "it is opened", "2 clocks start: 6 hours and 72 hours"),
     ("a clock at 5 hours with no report filed", "the timer fires", "1 escalation event is emitted"),
     ("a closed incident", "it is viewed", "the checklist shows 100% of required steps with timestamps")])
feat("F-56", "Data inventory report",
     "A report of personal data by field, purpose and classification generated from field tags.",
     "Should", ["N-12"], ["K7-T16"])

# ---------------------------------------------------------------- K8 files (M-07)
feat("F-57", "Blob storage port and file model",
     "S3-compatible and local adapters, file metadata, hashes, versions, entity links and export and erase handlers.",
     "Must", ["N-13"], ["K8-T01", "K8-T02", "K8-T10"], [
     ("the S3-compatible and local-disk adapters", "the contract suite runs", "2 of 2 adapters pass the same suite"),
     ("a file replaced by a new version", "versions are listed", "2 versions exist, each with a hash"),
     ("an erasure for a person with 10 files", "the eraser runs", "10 of 10 are deleted or flagged under statutory hold")])
feat("F-58", "Secure upload and download",
     "Signed direct upload with limits, content sniffing and checksums; short-lived permission-checked downloads; tenant-prefixed keys.",
     "Must", ["N-13"], ["K8-T03", "K8-T04", "K8-T11", "K8-T12"], [
     ("a 26 MB file and a 25 MB limit", "it is uploaded", "it is rejected before storage"),
     ("a file named photo.jpg with executable content", "its content is sniffed", "it is rejected by detected type with 1 error and 0 bytes stored"),
     ("a signed download URL with a 5-minute life", "it is used at minute 6", "the result is 403"),
     ("a key containing ../ or another tenant's prefix", "it is requested", "the result is 404 with 0 bytes returned")])
feat("F-59", "Document types and expiry tracking",
     "Document types declared by packs with required metadata and expiry events.",
     "Must", ["N-13"], ["K8-T05"], [
     ("a document type that requires an expiry date", "a file is uploaded without it", "the upload is rejected with 1 validation error"),
     ("a document expiring in 30 days", "the lead time is reached", "1 expiry event is emitted"),
     ("a pack declaring 5 document types", "it is not enabled for a tenant", "0 of the 5 types appear for that tenant")])
feat("F-60", "Malware scan and derivatives",
     "Scan port with quarantine; thumbnails and previews through jobs; metadata stripping.",
     "Should", ["N-13"], ["K8-T06", "K8-T07"])
feat("F-61", "File quotas and integrity",
     "Storage quotas through entitlements, orphan collection and integrity verification.",
     "Should", ["N-13"], ["K8-T08", "K8-T09"])

# ---------------------------------------------------------------- design system (M-08)
feat("F-62", "Design tokens and themes",
     "One token source for light and dark themes with the 80/20 brand colour budget and a safe theme switch.",
     "Must", ["N-16"], ["UI-T01", "UI-T02"], [
     ("design/tokens.css", "the contrast audit runs on both themes", "it reports 0 failures at 4.5:1 for text and 3:1 for control edges"),
     ("any component stylesheet", "the token lint runs", "0 raw hex values exist outside tokens.css"),
     ("no stored preference and an OS set to dark", "the application loads", "the dark theme applies with 0 theme flashes"),
     ("browser storage that is blocked", "the theme is toggled", "the theme still changes and 0 exceptions are thrown")])
feat("F-63", "Component library",
     "Buttons, form controls, dropdown menus, modals, toasts, banners and side panels with keyboard and screen-reader behaviour.",
     "Must", ["N-16"], ["UI-T03", "UI-T04", "UI-T05", "UI-T06"], [
     ("a menu trigger", "Enter, ArrowDown, ArrowUp, Home, End and Escape are pressed", "focus moves correctly on 6 of 6 keys and Escape returns focus to the trigger"),
     ("a menu with 9 items", "it opens", "a search field appears and the list scrolls at a height of 320 px"),
     ("a view with 2 primary buttons", "the lint runs", "it reports 1 violation, the limit being 1 primary button per view"),
     ("a modal", "it opens and closes", "focus stays inside across 10 Tab presses, Escape closes it and focus returns to the trigger")])
feat("F-64", "Application shell and page templates",
     "Global header, left rail, tab bar, utility bar and four templates: dashboard, list, record and settings.",
     "Must", ["N-16"], ["UI-T07", "UI-T08"], [
     ("viewports of 1440x900 and 1280x800", "the dashboard template renders", "0 horizontal scrollbars appear and every grid row spans 12 of 12 columns"),
     ("a viewport under 1100 px", "the shell renders", "the rail collapses to 48 px icons"),
     ("4 templates in 2 themes", "screenshots are compared with the approved baseline", "8 of 8 differ by under 0.1% of pixels")])
feat("F-65", "Data tables, charts and secure data display",
     "Dense tables with selection, bulk actions and row menus; token-driven charts; masked fields with audited reveal.",
     "Must", ["N-16"], ["UI-T09", "UI-T10", "UI-T11"], [
     ("a table with 3 rows selected", "the selection changes", "the bulk bar shows the count 3 and hides at 0"),
     ("a classified field", "it is displayed", "it shows only the last 4 characters and a reveal writes 1 sensitive-read audit row"),
     ("a chart", "it renders", "it has a text alternative and uses at most 1 accent-coloured series"),
     ("a 401 response", "it arrives while a form is open", "the user returns to sign-in with a message and 0 tokens or personal data are written to browser storage")])
feat("F-66", "Design quality gates",
     "CI checks for contrast, colour budget, inline styles and raw hex, accessibility scans and screenshot comparison in both themes.",
     "Must", ["N-16"], ["UI-T12", "UI-T13"], [
     ("a pull request that changes tokens", "CI runs", "the contrast audit covers 2 themes and fails any text pair below 4.5:1 or control edge below 3:1"),
     ("a template screenshot", "the colour budget runs", "it fails when orange exceeds 20% of brand-hued pixels"),
     ("4 templates in 2 themes", "the accessibility scan runs", "0 serious or critical violations are reported"),
     ("a shipped component with an inline style attribute", "the lint runs", "the build exits with code 1")])
feat("F-67", "Tenant branding with contrast guard",
     "Tenant logo, product name and accent colour with save-time contrast validation.",
     "Should", ["N-17"], ["UI-T14"])

MILESTONES = [
    ("M-01", "Foundation core boots: the sandbox host runs from the foundation alone and CI gates are green",
     ["F-01", "F-02", "F-03", "F-04", "F-05", "F-06"],
     "run the one-command environment; boot the sandbox and read the health output; break an import rule and watch CI fail; run all contract suites against the fakes"),
    ("M-02", "Tenants are isolated by the database and this is proven in CI",
     ["F-07", "F-08", "F-09", "F-10", "F-11", "F-12", "F-13"],
     "provision two tenants; query across them and get 0 rows; run the pool-leak test; suspend a tenant and watch calls fail; open a support session and read its audit trail"),
    ("M-03", "Events are never lost and every change is audited",
     ["F-14", "F-15", "F-16", "F-17", "F-18", "F-19", "F-20", "F-21", "F-22"],
     "kill the dispatcher mid-batch and show 0 lost events; send a poison event to the dead-letter queue and replay it; change a record and show its audit row; alter a row and let the verifier name it"),
    ("M-04", "A tenant reshapes its business without code",
     ["F-23", "F-24", "F-25", "F-26", "F-27", "F-28", "F-29"],
     "add a custom field and a lookup list; change a label in Hindi; apply a config bundle twice and show 0 changes; feed a hostile expression and show it rejected"),
    ("M-05", "People sign in securely and an AI assistant connects with the user's own permissions",
     ["F-30", "F-31", "F-32", "F-33", "F-34", "F-35", "F-36", "F-37", "F-38", "F-39"],
     "invite a user and enrol MFA; revoke a device; show a deny with a reason; connect Claude and ChatGPT connectors and call one tool each; show the audit actor as user via client"),
    ("M-06", "Plans and modules control access and workflows run on any record",
     ["F-40", "F-41", "F-42", "F-43", "F-44", "F-45", "F-46", "F-47", "F-48", "F-49", "F-50"],
     "disable a module for one tenant; hit a plan limit; run a record through an approval with a guard and an SLA; submit 2 concurrent transitions and show 1 conflict"),
    ("M-07", "Privacy duties and files work end to end",
     ["F-51", "F-52", "F-53", "F-54", "F-55", "F-56", "F-57", "F-58", "F-59", "F-60", "F-61"],
     "grant and withdraw consent; run an erasure request across 5 modules; export and delete a seeded tenant; upload a file and download it with a signed URL; open a breach incident and read both clocks"),
    ("M-08", "One accessible design system in light and dark themes",
     ["F-62", "F-63", "F-64", "F-65", "F-66", "F-67"],
     "open the reference page in both themes; operate every menu by keyboard; run the contrast and colour-budget checks; show a tenant accent rejected for low contrast"),
]
