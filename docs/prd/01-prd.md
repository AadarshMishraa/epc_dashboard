---
project: GX Foundation Kernel
client: GarunaCDX
version: 0.1-draft
status: draft
owner: Aadarsh Mishra
approvers: [Aadarsh Mishra]
---

# 1. Objective
Problem (3 sentences max): Each new business application rebuilds sign-in, tenancy, permissions, audit and privacy handling, and each rebuild risks a data leak between customers. Industry products cannot be sold as subscriptions or custom builds quickly while that base is repeated. The foundation is built once, proven isolated, and reused by every vertical.
Why now: The solar EPC owner dashboard is the first vertical and the architecture decisions (ADR-0001 to ADR-0005) are proposed and waiting on a stack decision.

| ID | Goal | Metric | Baseline | Target | By when |
|----|------|--------|----------|--------|---------|
| G-01 | The EPC pack runs on the foundation through public APIs only, so later verticals can cherry-pick | Foundation files edited for the EPC pack plus industry words found in foundation packages | no foundation exists | 0 edits and 0 words | end of wave 5 extraction drill |
| G-02 | No tenant can read or change another tenant's data | Cross-tenant reads or writes that succeed in the tenant matrix | not measured | 0 across 100% of tenant tables | every merge to main from wave 1 |
| G-03 | A vertical feature ships on foundation primitives alone | Working days to ship a record-plus-workflow feature using only manifests, fields and workflows | not measured | 5 working days or fewer | end of wave 5 |
| G-04 | Privacy duties are product behaviour, not manual work | Seeded access, correction and erasure requests completed inside the configured SLA | 0 of 20 (no desk exists) | 20 of 20 | end of wave 5 drill |
| G-05 | Owners can connect their own AI assistant safely | Connector conformance checks that pass (Claude, ChatGPT) | 0 of 2 | 2 of 2 | end of wave 4 |
| G-06 | Every screen is dense, accessible and on brand in both themes | Contrast failures and orange share of brand-hued pixels on shipped templates | reference page: 0 failures, 3% orange in light | 0 failures and at most 20% orange on every template | end of wave 5 |

# 2. Users
| ID | Role | Who they are | Device / language / tech comfort | How they do it today | Biggest pain | Primary? |
|----|------|--------------|----------------------------------|----------------------|--------------|----------|
| U-01 | Platform builder | Aadarsh and the agents that build verticals and the foundation | laptop, English, high | each project rebuilds sign-in, tenancy and audit by hand | repeated work and unproven isolation | yes |
| U-02 | Tenant owner or admin | Owner of a business on a vertical pack, for example a solar EPC firm | laptop and phone, Hindi and English, medium | spreadsheets and chat groups | no single view of money, work and people | no |
| U-03 | Staff member | Sales, site, accounts or operations user in a tenant | phone first, Hindi and English, low to medium | calls, chat groups and paper | slow handoffs and lost context | no |
| U-04 | AI assistant user | An owner or manager asking an AI assistant about their business | laptop or phone, English, medium | copying numbers into a chat by hand | no safe way to let the assistant read live data | no |
| U-05 | Data protection contact | Person in a tenant who answers privacy requests | laptop, English, medium | email threads and spreadsheets | no clock, no evidence, no routing | no |
| U-06 | Platform operator | GarunaCDX staff who support tenants and run plans | laptop, English, high | manual changes and ad hoc access | support access is unaudited and plans are edited by hand | no |

Buyer / payer: Tenant owners pay a subscription or a custom build fee; Aadarsh funds the foundation.

# 3. Needs
| ID | As (U-xx) I need | so that | Serves | Priority |
|----|------------------|---------|--------|----------|
| N-01 | As U-01 I need tenant isolation enforced below the application code | a forgotten filter cannot leak data | G-02 | Must |
| N-02 | As U-01 I need to add a vertical by declaring entities, fields, permissions and workflows as data | new products reuse the foundation unchanged | G-01, G-03 | Must |
| N-03 | As U-01 I need contracts, fakes and automated checks around every module | modules stay independent and extractable | G-01 | Must |
| N-04 | As U-01 I need events, jobs and schedules that survive crashes | no side effect is lost or applied twice | G-03 | Must |
| N-05 | As U-01 I need an audit trail that proves who did what and shows tampering | disputes and reviews can be settled with evidence | G-02, G-04 | Must |
| N-06 | As U-02 I need to control who can see and do what, down to branch and amount limits | staff see only what their job needs | G-02 | Must |
| N-07 | As U-02 I need to change labels, fields, lists and forms for my business without a developer | the product fits how my firm works | G-03 | Must |
| N-08 | As U-02 I need my plan and enabled modules to decide what my staff can use | I pay for and get exactly what I chose | G-03 | Must |
| N-09 | As U-03 I need to sign in securely and recover access without calling support | work is not blocked by lost passwords | G-02 | Must |
| N-10 | As U-02 I need approvals and deadlines to run on any record with a clear history | work moves on time and decisions are traceable | G-03 | Must |
| N-11 | As U-04 I need to connect my AI assistant with my own permissions | the assistant sees only what I may see | G-05 | Must |
| N-12 | As U-05 I need access, correction and erasure requests and breach clocks handled in the product | privacy duties are met on time with evidence | G-04 | Must |
| N-13 | As U-02 I need to store documents with expiry tracking and share them safely | paperwork is complete and not exposed | G-04 | Must |
| N-14 | As U-06 I need time-boxed, consented and audited access to a tenant | support is possible without silent access | G-02 | Should |
| N-15 | As U-02 I need single sign-on through my company identity provider | staff use one managed identity | G-02 | Later |
| N-16 | As U-01 I need one dense, accessible interface standard in light and dark themes | every screen looks and behaves the same | G-06 | Must |
| N-17 | As U-02 I need my own logo, name and accent colour that cannot break readability | the product looks like mine and stays legible | G-06 | Should |
| N-18 | As U-06 I need trials, expiry and licences handled by rules | plan changes need no manual work | G-03 | Should |
| N-19 | As U-01 I need dedicated-database deployments for clients who require them | regulated clients can be served from the same code | G-01 | Later |

# 4. Features
| ID | Feature | One line | Serves | Priority | Depends on |
|----|---------|----------|--------|----------|------------|
| F-01 | Stack decision, workspace and local environment | Decide the stack, lay out one package per module and start everything locally with one command. | N-03 | Must | - |
| F-02 | Core contracts, ports and redacted logging | Context, ids, errors, the nine core ports with in-memory fakes and structured logging with redaction. | N-03 | Must | F-01 |
| F-03 | Migration framework and test kit | Package-namespaced forward-only migrations, tenant matrix runner, contract harness and frozen clock. | N-03, N-01 | Must | F-01, F-02 |
| F-04 | Manifest, boundary and API gates | Manifest validator, import and table-ownership lint, industry-word lint and a public-API semver gate. | N-03, N-02 | Must | F-01 |
| F-05 | CI pipeline with security gates | One pipeline that runs lint, tests, tenant matrix, migration check, boundary lint, privacy check, secret scan and dependency scan. | N-03 | Must | F-03, F-04 |
| F-06 | Sandbox host and observability baseline | A composition root that boots from the foundation alone and lists what is registered, with metrics, tracing hooks and health probes; used for the extraction drill. | N-03, N-02 | Must | F-01, F-02 |
| F-07 | Tenant lifecycle and typed settings | Provision, suspend, reactivate, archive and schedule deletion; typed tenant settings; demo tenants. | N-01 | Must | F-02, F-03 |
| F-08 | Fail-closed tenant isolation | Mandatory tenant context and database row-level security so a forgotten filter cannot leak data. | N-01 | Must | F-02, F-03, F-07 |
| F-09 | Tenant resolution | Resolve the tenant from subdomain, custom domain or token claim, with a generic response for unknown tenants. | N-01 | Must | F-07 |
| F-10 | Organisation units and scope | Company, branch and team hierarchy with own, team, branch and tenant scope resolution. | N-06 | Must | F-08 |
| F-11 | Quota and rate-limit enforcement points | Places in the request path where limits from the entitlement module are enforced. | N-01 | Must | F-02, F-08 |
| F-12 | Silo routing | Route a tenant to a dedicated database or region by configuration only. | N-19 | Later | F-03, F-09 |
| F-13 | Support access sessions | Time-boxed, reasoned, consented and audited access for platform support staff. | N-14 | Should | F-02, F-08 |
| F-14 | Event envelope and transactional outbox | A versioned event envelope written in the same transaction as the state change. | N-04 | Must | F-02, F-04, F-08 |
| F-15 | Dispatch, subscriptions, retries and dead letters | At-least-once delivery, idempotent consumers, backoff with jitter, dead-letter queue and replay. | N-04 | Must | F-14, F-16 |
| F-16 | Job queue and tenant fairness | Jobs with tenant context, priority, delay, timeout, cancel, concurrency caps and fair scheduling across tenants. | N-04 | Must | F-02, F-08, F-11 |
| F-17 | Tenant-aware scheduler | Cron and one-off schedules in the tenant's timezone with single-fire and a missed-run policy. | N-04 | Must | F-16 |
| F-18 | Event operations and chaos tests | Lag, depth, retry and dead-letter metrics with alerts, plus kill, skew and poison soak tests. | N-04 | Must | F-06, F-15, F-17 |
| F-19 | Audit trail core | Append-only audit written in the same transaction, actor model including AI clients, masked diffs and a fail-closed policy. | N-05 | Must | F-02, F-08 |
| F-20 | Tamper-evident audit chain | Per-tenant hash chain with a verifier job that detects alteration. | N-05 | Must | F-19 |
| F-21 | Sensitive-read logging and audit query | Log reads of classified data and downloads; query and export the audit trail with permission checks. | N-05 | Must | F-02, F-19 |
| F-22 | Audit retention and archive | Monthly partitions, retention of at least 1 year, legal hold and archive. | N-05 | Should | F-17, F-19 |
| F-23 | Scoped configuration with versions | Typed config with default, pack, tenant, branch and user scopes; versioned, audited and reversible. | N-07 | Must | F-04, F-08, F-14 |
| F-24 | Labels and lookup lists | Tenant-editable vocabulary with locale fallback and managed enumerations. | N-07 | Must | F-23 |
| F-25 | Custom fields | Tenant-defined fields with validation, classification, lifecycle rules and write-time checking. | N-07, N-02 | Must | F-23 |
| F-26 | Custom field indexing and filtering | A capped registry of indexed fields with a filter and sort interface. | N-07 | Should | F-25 |
| F-27 | Condition language | A closed, sandboxed, versioned expression language used by guards, flags, permissions and computed fields. | N-07, N-02 | Must | F-02 |
| F-28 | Computed fields and form layouts | Computed fields with dependency order and cycle detection; form layouts as data with visibility rules. | N-07 | Should | F-25, F-27 |
| F-29 | Configuration bundles | Import and export of config with dry run, idempotent re-apply and version pinning. | N-02 | Must | F-23, F-25 |
| F-30 | Identity and credentials | Global user with per-tenant membership, memory-hard password hashing and a password policy aligned to NIST SP 800-63B-4. | N-09 | Must | F-08, F-23 |
| F-31 | Sign-in and sessions | Built-in provider, short access tokens, rotating refresh tokens with reuse detection, device list and revoke. | N-09 | Must | F-02, F-30 |
| F-32 | Multi-factor authentication and step-up | TOTP, recovery codes and a step-up check for sensitive actions. | N-09 | Must | F-31 |
| F-33 | Invitations, recovery and abuse protection | Single-use expiring invitations, reset flow, lockout and uniform responses that do not reveal accounts. | N-09 | Must | F-11, F-30, F-31, F-34 |
| F-34 | Roles and permission engine | Permissions declared by modules, roles as data, deny-by-default decisions with reasons and escalation guards. | N-06 | Must | F-04, F-10, F-15 |
| F-35 | Attribute conditions on permissions | Amount caps and discount limits expressed with the condition language. | N-06 | Should | F-27, F-34 |
| F-36 | Service accounts and API keys | Scoped, hashed, show-once keys with rotation, expiry and last-used tracking. | N-11 | Must | F-34 |
| F-37 | Single sign-on with OIDC | OIDC adapter and claim-to-role mapping, gated by the entitlement check. | N-15 | Later | F-02, F-31 |
| F-38 | OAuth for AI clients | Authorization code with PKCE S256, client registration, discovery metadata and conformance checks for Claude and ChatGPT connectors. | N-11 | Must | F-31, F-34 |
| F-39 | Authentication events and anomaly signals | Events for failures and new devices that other modules can subscribe to. | N-09 | Should | F-19, F-31 |
| F-40 | Module registry and per-tenant enablement | Installed modules and versions with a dependency check at boot; one check enables or hides a module for a tenant. | N-08 | Must | F-04, F-08 |
| F-41 | Plans, entitlements and usage metering | Boolean, limit and metered entitlements with overrides, an admin interface and idempotent usage records. | N-08 | Must | F-15, F-40 |
| F-42 | Feature flags | Tenant list, percentage and attribute rules with a kill switch. | N-08 | Should | F-27, F-41 |
| F-43 | Trial, expiry and subscription lifecycle | Trial, expiry and grace with read-only degradation; a subscription provider port with a stub. | N-18 | Should | F-17, F-41 |
| F-44 | Signed licence file | Offline-verifiable licence for dedicated and custom deployments. | N-18 | Later | F-41 |
| F-45 | Pack pinning and upgrades | Pin a tenant to a pack version and upgrade with dry run and rollback. | N-02, N-08 | Later | F-29, F-40 |
| F-46 | Workflow definitions and instances | Versioned state machines attached to any entity, with optimistic concurrency, history and why-blocked answers. | N-10 | Must | F-08, F-14, F-23 |
| F-47 | Guards, stage requirements, actions and explanations | Declarative and named guards, required fields and documents per stage, an action registry with a loop guard, and read interfaces that explain why a record is blocked. | N-10 | Must | F-25, F-27, F-46 |
| F-48 | SLA timers and stuck-instance sweeper | Business-calendar timers with pause and resume, breach events, escalation and a sweeper. | N-10 | Must | F-17, F-46 |
| F-49 | Approvals | Multi-step any-of and all-of approvals with delegation and expiry. | N-10 | Must | F-02, F-47 |
| F-50 | Workflow tooling | Definition validator, dry-run simulator, version migration of running instances and pack templates. | N-10 | Should | F-29, F-46, F-47 |
| F-51 | Notices and consent | Versioned notices per purpose and language; grant, withdraw and check consent with evidence. | N-12 | Must | F-14, F-23 |
| F-52 | Data-request desk | Access, correction, erasure, grievance and nominee requests run as workflows with SLA timers. | N-12 | Must | F-46, F-48 |
| F-53 | Retention engine | Retention policy per data class with scheduled delete or anonymise, advance notice and legal hold. | N-12 | Must | F-17, F-25 |
| F-54 | Erasure, export and tenant exit | Eraser and exporter orchestration with statutory-hold exceptions; full tenant export then deletion. | N-12 | Must | F-52 |
| F-55 | Incident log and breach clocks | Incident register with 6-hour and 72-hour clocks and a response checklist. | N-12 | Must | F-48 |
| F-56 | Data inventory report | A report of personal data by field, purpose and classification generated from field tags. | N-12 | Should | F-25 |
| F-57 | Blob storage port and file model | S3-compatible and local adapters, file metadata, hashes, versions, entity links and export and erase handlers. | N-13 | Must | F-02, F-03, F-08 |
| F-58 | Secure upload and download | Signed direct upload with limits, content sniffing and checksums; short-lived permission-checked downloads; tenant-prefixed keys. | N-13 | Must | F-02, F-21, F-57 |
| F-59 | Document types and expiry tracking | Document types declared by packs with required metadata and expiry events. | N-13 | Must | F-25, F-57 |
| F-60 | Malware scan and derivatives | Scan port with quarantine; thumbnails and previews through jobs; metadata stripping. | N-13 | Should | F-16, F-58 |
| F-61 | File quotas and integrity | Storage quotas through entitlements, orphan collection and integrity verification. | N-13 | Should | F-17, F-41, F-57 |
| F-62 | Design tokens and themes | One token source for light and dark themes with the 80/20 brand colour budget and a safe theme switch. | N-16 | Must | - |
| F-63 | Component library | Buttons, form controls, dropdown menus, modals, toasts, banners and side panels with keyboard and screen-reader behaviour. | N-16 | Must | F-01, F-62 |
| F-64 | Application shell and page templates | Global header, left rail, tab bar, utility bar and four templates: dashboard, list, record and settings. | N-16 | Must | F-63 |
| F-65 | Data tables, charts and secure data display | Dense tables with selection, bulk actions and row menus; token-driven charts; masked fields with audited reveal. | N-16 | Must | F-21, F-63, F-64 |
| F-66 | Design quality gates | CI checks for contrast, colour budget, inline styles and raw hex, accessibility scans and screenshot comparison in both themes. | N-16 | Must | F-62, F-64 |
| F-67 | Tenant branding with contrast guard | Tenant logo, product name and accent colour with save-time contrast validation. | N-17 | Should | F-07, F-63 |

Acceptance criteria (at least 3 per Must feature, Given / When / Then, with a number in the result):
F-01-AC1 Given a fresh clone When the one-command environment script runs Then the database, object-storage emulator and mail sink are running and seeded in under 5 minutes
F-01-AC2 Given the workspace When the build runs Then all 10 packages compile and each exposes exactly 1 public-API file
F-01-AC3 Given ADR-0006 is accepted When a reviewer opens it Then it names language, framework, Postgres version, queue approach, package manager and repo layout, 6 of 6 decided

F-02-AC1 Given a request, job or event When code runs Then the context carries tenant, actor and correlation id on 100% of 50 sampled log lines
F-02-AC2 Given the 9 core ports When their contract suites run against the fakes Then 9 of 9 suites pass
F-02-AC3 Given a log line containing a phone number, an email and an ID pattern When it is written Then all 3 patterns are masked

F-03-AC1 Given 2 packages with migrations When both run on an empty database Then they apply in dependency order in 1 pass and the ledger lists each once
F-03-AC2 Given a migration that drops a column the previous release reads When the migrate-from-previous check runs Then the build exits with code 1
F-03-AC3 Given a table with a tenant column When the tenant matrix runner reads, writes and deletes as tenant A against tenant B rows Then all 3 operations affect 0 rows
F-03-AC4 Given a frozen clock When a test advances 24 hours Then time-based code sees exactly 24 hours elapse

F-04-AC1 Given a manifest with an unknown key When the validator runs Then it exits non-zero and names the key
F-04-AC2 Given a foundation package importing a vertical package When the boundary lint runs Then it exits with code 1 and prints 1 offending import path
F-04-AC3 Given a foundation file containing an industry word When the lint runs Then it reports 1 violation with file and line
F-04-AC4 Given a removed public export without a major version bump When the API diff runs Then the gate exits with code 1

F-05-AC1 Given a pull request When CI runs Then 9 stages run: lint, unit, contract, tenant matrix, migrate-from-previous, boundary lint, privacycheck, secret scan, dependency scan
F-05-AC2 Given a dependency with a known critical advisory When the scan runs Then the build exits with code 1 and names the package
F-05-AC3 Given a committed string matching a secret pattern When the secret scan runs Then the build exits with code 1
F-05-AC4 Given a typical pull request When the full pipeline runs Then it finishes in under 15 minutes

F-06-AC1 Given the sandbox host When liveness and readiness are probed Then liveness returns 200 and readiness reports 0 failing dependencies
F-06-AC2 Given only the foundation packages When the sandbox boots Then health returns ok and every installed package is listed
F-06-AC3 Given a throwaway module declared by manifest only When it is added to the sandbox Then it appears in the registered list with 0 foundation files changed
F-06-AC4 Given an empty database When the host starts Then migrations apply and the process reports ready in under 30 seconds

F-07-AC1 Given a new tenant request When provisioning runs Then the tenant, default settings and default roles exist after 1 transaction and tenant.created is emitted once
F-07-AC2 Given an active tenant When it is suspended Then every API call for it returns 403 within 60 seconds and tenant.suspended is emitted once
F-07-AC3 Given a tenant When settings are read Then region, timezone, currency, locale, fiscal-year start and branding tokens return as typed values, 6 of 6 present
F-07-AC4 Given a demo tenant When reset runs twice Then both runs yield identical row counts across all tables

F-08-AC1 Given a query with no tenant context When it runs Then it is rejected with error code TENANT_REQUIRED and returns 0 rows
F-08-AC2 Given a tenant table created by the helper When tenant A reads, updates and deletes Then 0 of tenant B's rows are visible or changed
F-08-AC3 Given 200 concurrent requests across 20 tenants on a pool of 10 connections When the pool-leak test runs Then 0 requests observe another tenant's setting
F-08-AC4 Given the application database role When its privileges are inspected Then it is not the table owner and has no BYPASSRLS, 2 of 2 checks pass

F-09-AC1 Given a request on a registered subdomain When it is resolved with a warm cache Then the tenant id returns in under 5 ms
F-09-AC2 Given an unknown host When it is resolved Then the response is a generic 404 identical to 1 reference body and discloses 0 tenant names
F-09-AC3 Given a token claim and a host that name different tenants When the request arrives Then it is rejected with 403 and 1 audit event is written

F-10-AC1 Given a company with 3 branches and 5 teams When scope branch is resolved for a user Then only that branch and its teams are returned
F-10-AC2 Given a user with scope own When records are listed Then only records they own return and 0 others
F-10-AC3 Given a branch moved to another company When scope is resolved on the next request Then the new hierarchy applies and 0 stale grants remain

F-11-AC1 Given a tenant with a limit of 100 requests per minute When 101 requests arrive in 60 seconds Then request 101 returns 429 with a retry-after value
F-11-AC2 Given a quota provider fake that denies When an action runs Then the action is blocked with 1 reason that names the limit key
F-11-AC3 Given 2 tenants where one exceeds its limit When both send traffic Then the other tenant's p95 latency stays within 10% of its baseline

F-14-AC1 Given a state change and an event in 1 transaction When the transaction rolls back Then 0 outbox rows exist
F-14-AC2 Given an event type whose required field changed When the compatibility check runs Then CI exits with code 1 unless the version number increases by 1
F-14-AC3 Given an envelope without a tenant When it is published Then it is rejected with 1 error code

F-15-AC1 Given 4 workers and 10,000 events When all events are dispatched Then every event takes effect exactly once and per-entity order holds
F-15-AC2 Given a handler that fails 3 times then succeeds When it is retried Then it succeeds on attempt 4 with increasing delays and jitter
F-15-AC3 Given a poison event When it exceeds the configured 8 attempts Then it lands in the dead-letter queue and 1 replay command re-queues it
F-15-AC4 Given the same event delivered twice When the consumer runs Then the processed-event table makes the second run a no-op

F-16-AC1 Given a job enqueued with tenant context When a worker runs it Then the worker restores that tenant and 0 queries run without it
F-16-AC2 Given tenant A queues 10,000 jobs and tenant B queues 10 When workers run Then B's jobs start within 30 seconds
F-16-AC3 Given a job past its 60-second timeout When the timeout fires Then the job is cancelled and marked failed 1 time

F-17-AC1 Given a daily 09:00 schedule for a tenant in Asia/Kolkata When it fires Then it runs once at 09:00 local time
F-17-AC2 Given 3 scheduler instances When a tick occurs Then exactly 1 instance fires the job
F-17-AC3 Given a 2-hour outage When service resumes Then the configured missed-run policy applies: 1 catch-up run or 0

F-18-AC1 Given a dispatcher killed mid-batch 1,000 times When the soak test ends Then 0 events are lost and 0 take effect twice
F-18-AC2 Given a dead-letter queue above 100 entries When the metric is evaluated Then an alert fires within 5 minutes
F-18-AC3 Given a clock skew of 5 minutes When the scheduler runs Then no job fires twice

F-19-AC1 Given a state change When the transaction commits Then 1 audit row exists with actor, action, entity, tenant and correlation id
F-19-AC2 Given a configured entity with a classified field When the field changes Then the stored diff holds that field masked and 0 raw values
F-19-AC3 Given a critical action and a failing audit write When the action runs Then the action fails and 0 state changes persist
F-19-AC4 Given an AI client acting for a user When it performs an action Then the audit actor records 2 identities: the user and the client

F-20-AC1 Given 10,000 audit rows When the verifier runs Then it reports 0 breaks
F-20-AC2 Given 1 row altered directly in the database When the verifier runs Then it names the first broken row
F-20-AC3 Given the verifier finds a break When the daily job completes Then an alert is raised within 5 minutes

F-21-AC1 Given a read of a classified field When it executes Then 1 sensitive-read audit row is written
F-21-AC2 Given a user without the audit.read permission When they query the audit log Then they receive 403 and 0 rows
F-21-AC3 Given an export of 100,000 audit rows When it is requested Then it streams in batches of 1,000 and every cell starting with =, +, - or @ is neutralised

F-23-AC1 Given a key set at default, pack, tenant and user levels When it is resolved for a user Then the most specific level wins, 4 of 4 precedence cases pass
F-23-AC2 Given a config change When it is saved Then version n+1 exists with author and time and 1 event is emitted
F-23-AC3 Given a rollback to version n-1 When it is applied Then values match that version exactly and 1 new audited version is created

F-24-AC1 Given a missing label in locale hi When it is rendered Then it falls back to en and 1 missing-key report row is recorded
F-24-AC2 Given a lookup value used by existing records When it is deactivated Then 0 existing records change and 0 new records can select it
F-24-AC3 Given a lookup list of 50 values When it is reordered Then the next read returns the new order for all users

F-25-AC1 Given a numeric field with a range of 0 to 100 When a value of 101 is written Then the write fails with 1 field-level error
F-25-AC2 Given a field defined without a data classification When it is saved Then it is rejected with 1 validation error
F-25-AC3 Given a field that already holds data When its type is changed Then the change is refused with 1 error code
F-25-AC4 Given 50 custom fields on 1 entity When a record is read Then p95 read time stays within 20% of the same entity with 0 custom fields

F-27-AC1 Given a hostile expression nested 10,000 levels deep When it is evaluated Then it is rejected in under 50 ms with no stack overflow
F-27-AC2 Given an expression calling an undefined function When it is validated Then it fails with 1 error naming the function
F-27-AC3 Given the grammar When it is reviewed Then it contains 0 functions for file, network or clock access and the same inputs give identical results across 1,000 runs

F-29-AC1 Given a bundle When it is applied twice Then the second apply changes 0 rows
F-29-AC2 Given a dry run When it is requested Then the diff lists every create, update and delete before anything is written
F-29-AC3 Given a bundle pinned to version 2 When it is applied to a tenant on version 3 Then it is rejected with a version-conflict error

F-30-AC1 Given 1 person in 3 tenants When they sign in Then 1 global user and 3 memberships exist
F-30-AC2 Given passwords of 15 and 64 characters not on the blocklist When they are set Then both are accepted and no composition rule is applied
F-30-AC3 Given a stored hash with old parameters When the user signs in Then it is rehashed on that 1 sign-in and the stored parameter version equals the current version
F-30-AC4 Given a password on the blocklist When it is set Then it is rejected with 1 stated reason

F-31-AC1 Given an access token lifetime of 15 minutes When a token is used at minute 16 Then it is rejected with 401
F-31-AC2 Given a refresh token used twice When the second use arrives Then the whole token family is revoked and 1 security event is raised
F-31-AC3 Given a user with 3 devices When 1 is revoked Then its next refresh fails and the other 2 continue
F-31-AC4 Given a session idle past the idle timeout When any request arrives Then the response is 401 and 1 new sign-in is required

F-32-AC1 Given a TOTP enrolment When a valid code is entered Then 10 single-use recovery codes are issued once
F-32-AC2 Given a sensitive action marked step-up When it is performed without a second factor in the last 5 minutes Then it is refused with a step-up challenge
F-32-AC3 Given 5 wrong codes in 10 minutes When another code is tried Then the attempt is rate limited and 1 anomaly event is raised

F-33-AC1 Given an invitation with a 7-day expiry When it is used on day 8 Then it fails, and an invitation used once on day 2 fails on second use
F-33-AC2 Given a reset request for a known email and one for an unknown email When both are submitted Then status and body are identical and response times differ by under 50 ms
F-33-AC3 Given 10 failed sign-ins in 15 minutes When the next one arrives Then the account is slowed or locked per policy and 1 anomaly event is raised

F-34-AC1 Given a user with no grant When they call any action Then the decision is deny with 1 reason code
F-34-AC2 Given a role change When it is saved Then cached decisions for that user are invalidated within 5 seconds
F-34-AC3 Given a user who can edit roles When they grant a permission they do not hold Then it is refused and the 500-case escalation property test finds 0 paths
F-34-AC4 Given the last remaining admin When they are demoted or removed Then the change is refused and 1 admin remains

F-36-AC1 Given a newly created key When it is displayed Then it is shown once and 0 plaintext copies exist in the database
F-36-AC2 Given a key scoped to read orders When it calls a write action Then the result is 403
F-36-AC3 Given a key past its expiry When it is used Then the result is 401 and the failed attempt is logged

F-38-AC1 Given the Claude connector When it registers and runs authorization code with PKCE S256 Then it receives tokens scoped to the signed-in user and 1 conformance check passes
F-38-AC2 Given the ChatGPT connector When it runs the same flow Then 1 conformance check passes
F-38-AC3 Given an authorization request with PKCE method plain When it is sent Then it is rejected with a 400 error
F-38-AC4 Given an AI client token When it calls a tool the user may not use Then the result is 403 and the audit actor shows the user and the client

F-40-AC1 Given a module whose dependency is missing When the host boots Then boot exits with code 1 and lists 1 missing module
F-40-AC2 Given a module disabled for a tenant When its route, navigation entry, AI tool and job are invoked Then all 4 are refused through the same single check
F-40-AC3 Given an enablement change When it is saved Then it takes effect within 60 seconds

F-41-AC1 Given a plan with a limit of 5 users When a 6th user is invited Then it is refused and the response names the limit key
F-41-AC2 Given a per-tenant override with an expiry date When the date passes Then the plan value applies again within 5 minutes
F-41-AC3 Given a usage record submitted twice with the same idempotency key When both are processed Then usage increases by 1, not 2
F-41-AC4 Given an entitlement store outage When a security-relevant limit is checked Then the check returns deny for 100% of security-relevant keys

F-46-AC1 Given a published workflow version When it is edited Then a new version is created and the published one is unchanged
F-46-AC2 Given 2 concurrent transitions on the same instance When both are submitted Then exactly 1 succeeds and 1 receives a conflict error
F-46-AC3 Given a completed transition When history is read Then it records 4 fields: actor, from-state, to-state and time

F-47-AC1 Given a blocked instance When why-blocked is requested Then it names each failing guard, 100% of them
F-47-AC2 Given a transition guarded by amount at most 100000 When an amount of 100001 is submitted Then it is refused and the guard is named
F-47-AC3 Given a stage that requires 2 documents When 1 is attached and a transition is attempted Then the transition is refused
F-47-AC4 Given an action that triggers the same transition again When it runs Then the loop guard stops it after at most 10 hops

F-48-AC1 Given a 2-business-day SLA on a Monday to Friday calendar When it starts Friday 17:00 Then the breach time is Tuesday 17:00
F-48-AC2 Given a paused instance When it is resumed Then the remaining time differs by 0 minutes from the value at pause
F-48-AC3 Given an instance with no activity for 30 days When the sweeper runs Then it is reported as stuck exactly once

F-49-AC1 Given a 2-step approval where step 1 needs any of 3 approvers When 1 approves Then step 1 completes and step 2 starts
F-49-AC2 Given an approver with a delegate When a request arrives Then 1 delegate notification is sent and the audit shows 2 people
F-49-AC3 Given an approval with a 3-day expiry When it expires Then the configured outcome, escalate or reject, happens once

F-51-AC1 Given a granted consent When it is checked Then it returns 3 evidence fields: notice version, language and timestamp
F-51-AC2 Given a withdrawn consent When processing for that purpose checks it Then it returns false from the very next check with 0 stale grants
F-51-AC3 Given a new notice version When it is published Then 0 existing consents are silently upgraded

F-52-AC1 Given an erasure request When it is opened Then 1 workflow instance with the configured SLA starts and is routed to 1 tenant admin
F-52-AC2 Given the 5 request types When templates are listed Then 5 of 5 have a workflow template
F-52-AC3 Given a request at 80% of its SLA When the timer fires Then 1 reminder event is emitted

F-53-AC1 Given a retention policy of 24 months for a data class When records age beyond it Then they are deleted or anonymised by the next scheduled run
F-53-AC2 Given a legal hold on a record When retention runs Then the record is skipped and 1 skip is logged
F-53-AC3 Given an advance-notice setting of 7 days When a record nears deletion Then 1 notice event is emitted 7 days before

F-54-AC1 Given a seeded person with data in 5 modules When erasure runs Then 5 of 5 handlers run and any statutory-hold exception is recorded
F-54-AC2 Given a tenant exit When the export runs Then it contains 100% of tables that have exporter handlers, with a checksum
F-54-AC3 Given a completed tenant deletion When it is verified Then 0 rows remain for the tenant and 1 deletion record remains

F-55-AC1 Given an incident marked as a personal-data breach When it is opened Then 2 clocks start: 6 hours and 72 hours
F-55-AC2 Given a clock at 5 hours with no report filed When the timer fires Then 1 escalation event is emitted
F-55-AC3 Given a closed incident When it is viewed Then the checklist shows 100% of required steps with timestamps

F-57-AC1 Given the S3-compatible and local-disk adapters When the contract suite runs Then 2 of 2 adapters pass the same suite
F-57-AC2 Given a file replaced by a new version When versions are listed Then 2 versions exist, each with a hash
F-57-AC3 Given an erasure for a person with 10 files When the eraser runs Then 10 of 10 are deleted or flagged under statutory hold

F-58-AC1 Given a 26 MB file and a 25 MB limit When it is uploaded Then it is rejected before storage
F-58-AC2 Given a file named photo.jpg with executable content When its content is sniffed Then it is rejected by detected type with 1 error and 0 bytes stored
F-58-AC3 Given a signed download URL with a 5-minute life When it is used at minute 6 Then the result is 403
F-58-AC4 Given a key containing ../ or another tenant's prefix When it is requested Then the result is 404 with 0 bytes returned

F-59-AC1 Given a document type that requires an expiry date When a file is uploaded without it Then the upload is rejected with 1 validation error
F-59-AC2 Given a document expiring in 30 days When the lead time is reached Then 1 expiry event is emitted
F-59-AC3 Given a pack declaring 5 document types When it is not enabled for a tenant Then 0 of the 5 types appear for that tenant

F-62-AC1 Given design/tokens.css When the contrast audit runs on both themes Then it reports 0 failures at 4.5:1 for text and 3:1 for control edges
F-62-AC2 Given any component stylesheet When the token lint runs Then 0 raw hex values exist outside tokens.css
F-62-AC3 Given no stored preference and an OS set to dark When the application loads Then the dark theme applies with 0 theme flashes
F-62-AC4 Given browser storage that is blocked When the theme is toggled Then the theme still changes and 0 exceptions are thrown

F-63-AC1 Given a menu trigger When Enter, ArrowDown, ArrowUp, Home, End and Escape are pressed Then focus moves correctly on 6 of 6 keys and Escape returns focus to the trigger
F-63-AC2 Given a menu with 9 items When it opens Then a search field appears and the list scrolls at a height of 320 px
F-63-AC3 Given a view with 2 primary buttons When the lint runs Then it reports 1 violation, the limit being 1 primary button per view
F-63-AC4 Given a modal When it opens and closes Then focus stays inside across 10 Tab presses, Escape closes it and focus returns to the trigger

F-64-AC1 Given viewports of 1440x900 and 1280x800 When the dashboard template renders Then 0 horizontal scrollbars appear and every grid row spans 12 of 12 columns
F-64-AC2 Given a viewport under 1100 px When the shell renders Then the rail collapses to 48 px icons
F-64-AC3 Given 4 templates in 2 themes When screenshots are compared with the approved baseline Then 8 of 8 differ by under 0.1% of pixels

F-65-AC1 Given a table with 3 rows selected When the selection changes Then the bulk bar shows the count 3 and hides at 0
F-65-AC2 Given a classified field When it is displayed Then it shows only the last 4 characters and a reveal writes 1 sensitive-read audit row
F-65-AC3 Given a chart When it renders Then it has a text alternative and uses at most 1 accent-coloured series
F-65-AC4 Given a 401 response When it arrives while a form is open Then the user returns to sign-in with a message and 0 tokens or personal data are written to browser storage

F-66-AC1 Given a pull request that changes tokens When CI runs Then the contrast audit covers 2 themes and fails any text pair below 4.5:1 or control edge below 3:1
F-66-AC2 Given a template screenshot When the colour budget runs Then it fails when orange exceeds 20% of brand-hued pixels
F-66-AC3 Given 4 templates in 2 themes When the accessibility scan runs Then 0 serious or critical violations are reported
F-66-AC4 Given a shipped component with an inline style attribute When the lint runs Then the build exits with code 1

# 5. Non-functional requirements
| ID | Area | Requirement | How verified |
|----|------|-------------|--------------|
| NF-01 | Performance | A permission decision takes p95 under 5 ms with 10,000 grants and a warm cache; a tenant-scoped list query takes p95 under 100 ms at 1,000,000 rows | nightly benchmark in CI |
| NF-02 | Isolation | 0 cross-tenant rows readable or writable across 100% of tenant tables | tenant matrix and pool-leak test on every merge |
| NF-03 | Reliability | 0 events lost and 0 applied twice across 1,000 forced worker kills | chaos and soak test |
| NF-04 | Security | 0 open Critical or High findings at each milestone gate; 1 STRIDE threat model per Must feature | gx-security-reviewer gate plus dependency and secret scans |
| NF-05 | Privacy | Erasure and export finish inside the tenant SLA (default 30 days) for 100% of 20 seeded requests; personal data masked on 100% of lines in the redaction test | seeded drill and log-redaction test |
| NF-06 | Accessibility | WCAG 2.2 AA on 4 templates in 2 themes with 0 serious or critical axe violations | axe in CI plus a keyboard pass per template |
| NF-07 | Extractability | 0 imports from vertical packages and 0 industry words in 10 foundation packages | boundary lint and the extraction drill |
| NF-08 | Scale | 1,000 tenants and 200 concurrent requests per node on pooled Postgres with 0 pool leaks | load test and pool-leak test |
| NF-09 | Compatibility | 100% of public-API changes carry a semver bump; migrations apply from the previous release with 0 failures | API diff gate and migrate-from-previous check |
| NF-10 | Brand budget | Orange at most 20% of brand-hued pixels and text contrast at least 4.5:1 on every template | colorbudget.py and contrast.py in CI |

# 6. Constraints
Industry and country: Horizontal foundation; India privacy and incident rules shape the privacy desk (docs/compliance).
Integrations: Identity provider, message sender and object storage are ports with adapters; the owner of every external account is Aadarsh.
Tech mandates: PostgreSQL with row-level security (ADR-0002); modular monolith (ADR-0001); no vertical words in foundation packages.
Existing systems and data to migrate: None.
Budget: Not set.
Deadline: None fixed; each wave closes at its gate.
Team: Aadarsh decides and accepts; agents build and review under docs/plans/README.md.

# 7. Out of scope
| ID | Not building | Why | Revisit |
|----|--------------|-----|---------|
| X-01 | Industry features: quotes, bills of material, GST invoices, site surveys, solar design | They belong to vertical packs on top of the foundation | EPC pack PRD |
| X-02 | Utilities layer (L1): notifications, templates, payment adapters, reporting engine | Mapped separately after the foundation | after wave 5 |
| X-03 | Native mobile apps | Web first; the design system is responsive | later phase |
| X-04 | Collecting subscription payments | Only a provider port and a stub are built | v2 |
| X-05 | External message broker and multi-region active-active | Database-backed queue is enough for launch | v2 |
| X-06 | Visual workflow designer | Workflows are data first; a designer comes after the model is stable | later phase |

# 8. Assumptions and risks
| ID | Assumption or risk | Likelihood | Impact | Mitigation | Owner |
|----|--------------------|-----------|--------|------------|-------|
| R-01 | Stack not decided, so wave 0 cannot start | M | H | Decide ADR-0006 before any task; the planner agent drafts the options | Aadarsh |
| R-02 | Foundation grows ahead of real need (dumping ground) | M | H | Rule of two: nothing is generalised before a second vertical needs it; size and import budget reviewed each wave | Aadarsh |
| R-03 | A missed row-level security policy leaks data across tenants | L | H | Forced RLS, tenant matrix on every table, security review on every S3 task | gx-security-reviewer |
| R-04 | OAuth server complexity delays AI connectors | M | H | ADR to delegate the protocol and keep permissions in house (K2-T15) | Aadarsh |
| R-05 | Agent-written code drifts from the architecture | M | M | Boundary lint, staff review on every M task, definition of done per task | gx-staff-reviewer |
| R-06 | Custom-field storage hurts query performance | M | M | ADR before K4-T06; capped index registry; 20% read-time budget in F-25 | gx-implementer |
| R-07 | Privacy rules or interpretations change | M | M | Policies are data; compliance register reviewed by counsel before launch | Aadarsh |
| R-08 | Wave 4 holds 42 tasks and is a bottleneck | H | M | Three parallel lanes (K2, K3, K5) with separate agents | Aadarsh |
| R-09 | Brand colour budget erodes through drift | L | L | colorbudget.py and contrast.py gates in CI | gx-ux-reviewer |

# 9. Success and launch criteria
Success (90 days after the first vertical goes live on the foundation): G-02 holds with 0 cross-tenant incidents, G-03 is met on 2 real features, and no foundation file was edited for the vertical (G-01).
Launch gate: All Must features pass their acceptance criteria on staging; the extraction drill passes; 0 open Critical or High security findings; the data-request drill completes 20 of 20 seeded requests; Aadarsh signs off.

# 10. Brand
Guide: docs/prd/brand/ and docs/design/design-system.md
Tone of voice: precise, calm, businesslike
References: Salesforce Lightning density and structure; a quiet enterprise tone with one orange action per view

# 11. Open questions and decisions
| ID | Question | Owner | Needed by | Answer |
|----|----------|-------|-----------|--------|
| Q-01 | Stack and hosting: language, framework, Postgres version, queue approach, package manager | Aadarsh | before K0-T01 | Decided 2026-11-04: TypeScript, Next.js on Vercel, Supabase Postgres in Mumbai, database-backed queue (ADR-0006) |
| Q-02 | Repo shape: monorepo or a separate foundation repo | Aadarsh | before K0-T02 | Decided 2026-11-04: monorepo (ADR-0006) |
| Q-03 | Accept ADR-0001 to ADR-0005 | Aadarsh | before wave 0 | Decided 2026-11-04: ADR-0001 to ADR-0005 accepted |
| Q-04 | Name the second vertical for the rule of two | Aadarsh | when a second vertical starts | Deferred 2026-11-04: EPC only for now; a later vertical cherry-picks from the foundation |
| Q-05 | OAuth server: build or delegate | Aadarsh | before K2-T15 | Direction 2026-11-04: delegate the protocol to Supabase Auth behind the identity port; confirm GA, connector conformance and password policy before K2-T15 (ADR-0006) |
| Q-06 | Workflow engine: in-house or adopt | Aadarsh | before K5-T01 | Open. Lean: in-house |
| Q-07 | Licence and IP model for client custom builds | Aadarsh and counsel | before K3-T09 | Open. K3-T09 is now Later, so this can wait |
| Q-08 | Front-end binding for the design system (framework wrappers) | Aadarsh | before UI-T03 | Decided 2026-11-04: React wrappers over the CSS classes (ADR-0006) |

# 12. Sign-off
Baseline v1.0 approved by: pending (Aadarsh Mishra)
Later changes only via docs/prd/changes/CR-xxx.md
