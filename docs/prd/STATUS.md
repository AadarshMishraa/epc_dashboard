# STATUS (updated 2026-11-05 by session 3)
Release target: foundation v1.0 (date TBD)   Current phase: P1 Foundation   Overall: GREEN

GREEN: 2026-11-05: K0-T14 done. gx-security-reviewer approved and gx-staff-reviewer approved with fixes; all findings fixed and the deferred items logged as TD-7 to TD-13. F-02-AC2: 9 of 9 suites pass locally. TD-7 (transaction binding for writing ports) must be decided at K6-T01. ADR-0006 accepted 2026-11-04 (stack, hosting, monorepo); wave 0 is unblocked. K0-T02 done 2026-11-04 (gx-staff-reviewer approved after fixes; 4 Low and Medium findings deferred to K0-T08, see .claude/memory/DECISIONS.md). F-01-AC2 counts the 10 `kind: module` packages; testkit and toolchain are support packages in the same lane. 2026-11-04: Postgres 17 pinned; Supabase and Vercel configured with placeholders (docs/operations/environments.md). Owner steps: create both projects in Mumbai and add keys before the first hosted deploy or migration (owner Aadarsh). Local Docker is unavailable in the cloud container, so the local stack (K0-T11) is verified on a developer machine or in CI. Open decisions D-04, D-05, D-06 and D-07 block later waves only.

States are a closed set: Not started, In progress, In review, Blocked, Done, Deferred. No percentages.
RAG: GREEN on date and unblocked; AMBER slip of 3 working days or less, or a blocker with an owner and a fix date; RED slip over 3 working days or blocked with no fix date.
Done for a feature means every acceptance criterion passes on staging ("N of N pass"). Done for a milestone needs evidence.

## Milestones
| ID | Outcome the client can verify | Features | Date | State | RAG | Evidence |
|----|-------------------------------|----------|------|-------|-----|----------|
| M-01 | Foundation core boots: the sandbox host runs from the foundation alone and CI gates are green | F-01, F-02, F-03, F-04, F-05, F-06 | TBD | In progress | GREEN | - |
| M-02 | Tenants are isolated by the database and this is proven in CI | F-07, F-08, F-09, F-10, F-11, F-12, F-13 | TBD | Not started | GREEN | - |
| M-03 | Events are never lost and every change is audited | F-14, F-15, F-16, F-17, F-18, F-19, F-20, F-21, F-22 | TBD | Not started | GREEN | - |
| M-04 | A tenant reshapes its business without code | F-23, F-24, F-25, F-26, F-27, F-28, F-29 | TBD | Not started | GREEN | - |
| M-05 | People sign in securely and an AI assistant connects with the user's own permissions | F-30, F-31, F-32, F-33, F-34, F-35, F-36, F-37, F-38, F-39 | TBD | Not started | GREEN | - |
| M-06 | Plans and modules control access and workflows run on any record | F-40, F-41, F-42, F-43, F-44, F-45, F-46, F-47, F-48, F-49, F-50 | TBD | Not started | GREEN | - |
| M-07 | Privacy duties and files work end to end | F-51, F-52, F-53, F-54, F-55, F-56, F-57, F-58, F-59, F-60, F-61 | TBD | Not started | GREEN | - |
| M-08 | One accessible design system in light and dark themes | F-62, F-63, F-64, F-65, F-66, F-67 | TBD | Not started | GREEN | - |

## Features
| ID | Name | Priority | Milestone | State | Acceptance | Tests | PR |
|----|------|----------|-----------|-------|-----------|-------|----|
| F-01 | Stack decision, workspace and local environment | Must | M-01 | In progress | 2 of 3 pass (AC2 local, AC3; AC1 needs K0-T11) | toolchain import-graph suite, `pnpm verify` | - |
| F-02 | Core contracts, ports and redacted logging | Must | M-01 | In progress | 3 of 3 pass locally (AC1 and AC3 in core logger tests; AC2 contract suites); K0-T04 security review pending | core unit and property tests; testkit contract suites on the fakes | - |
| F-03 | Migration framework and test kit | Must | M-01 | In progress | 1 of 4 pass (AC1 on local Postgres 16; Postgres 17 in CI pending K0-T10) | migrate unit and db suites | - |
| F-04 | Manifest, boundary and API gates | Must | M-01 | In progress | 2 of 4 pass (AC1; AC4 from 1.0.0, wording CR-001 proposed) | toolchain manifest and API suites | - |
| F-05 | CI pipeline with security gates | Must | M-01 | Not started | 0 of 4 pass | - | - |
| F-06 | Sandbox host and observability baseline | Must | M-01 | Not started | 0 of 4 pass | - | - |
| F-07 | Tenant lifecycle and typed settings | Must | M-02 | Not started | 0 of 4 pass | - | - |
| F-08 | Fail-closed tenant isolation | Must | M-02 | Not started | 0 of 4 pass | - | - |
| F-09 | Tenant resolution | Must | M-02 | Not started | 0 of 3 pass | - | - |
| F-10 | Organisation units and scope | Must | M-02 | Not started | 0 of 3 pass | - | - |
| F-11 | Quota and rate-limit enforcement points | Must | M-02 | Not started | 0 of 3 pass | - | - |
| F-12 | Silo routing | Later | M-02 | Not started | - | - | - |
| F-13 | Support access sessions | Should | M-02 | Not started | - | - | - |
| F-14 | Event envelope and transactional outbox | Must | M-03 | Not started | 0 of 3 pass | - | - |
| F-15 | Dispatch, subscriptions, retries and dead letters | Must | M-03 | Not started | 0 of 4 pass | - | - |
| F-16 | Job queue and tenant fairness | Must | M-03 | Not started | 0 of 3 pass | - | - |
| F-17 | Tenant-aware scheduler | Must | M-03 | Not started | 0 of 3 pass | - | - |
| F-18 | Event operations and chaos tests | Must | M-03 | Not started | 0 of 3 pass | - | - |
| F-19 | Audit trail core | Must | M-03 | Not started | 0 of 4 pass | - | - |
| F-20 | Tamper-evident audit chain | Must | M-03 | Not started | 0 of 3 pass | - | - |
| F-21 | Sensitive-read logging and audit query | Must | M-03 | Not started | 0 of 3 pass | - | - |
| F-22 | Audit retention and archive | Should | M-03 | Not started | - | - | - |
| F-23 | Scoped configuration with versions | Must | M-04 | Not started | 0 of 3 pass | - | - |
| F-24 | Labels and lookup lists | Must | M-04 | Not started | 0 of 3 pass | - | - |
| F-25 | Custom fields | Must | M-04 | Not started | 0 of 4 pass | - | - |
| F-26 | Custom field indexing and filtering | Should | M-04 | Not started | - | - | - |
| F-27 | Condition language | Must | M-04 | Not started | 0 of 3 pass | - | - |
| F-28 | Computed fields and form layouts | Should | M-04 | Not started | - | - | - |
| F-29 | Configuration bundles | Must | M-04 | Not started | 0 of 3 pass | - | - |
| F-30 | Identity and credentials | Must | M-05 | Not started | 0 of 4 pass | - | - |
| F-31 | Sign-in and sessions | Must | M-05 | Not started | 0 of 4 pass | - | - |
| F-32 | Multi-factor authentication and step-up | Must | M-05 | Not started | 0 of 3 pass | - | - |
| F-33 | Invitations, recovery and abuse protection | Must | M-05 | Not started | 0 of 3 pass | - | - |
| F-34 | Roles and permission engine | Must | M-05 | Not started | 0 of 4 pass | - | - |
| F-35 | Attribute conditions on permissions | Should | M-05 | Not started | - | - | - |
| F-36 | Service accounts and API keys | Must | M-05 | Not started | 0 of 3 pass | - | - |
| F-37 | Single sign-on with OIDC | Later | M-05 | Not started | - | - | - |
| F-38 | OAuth for AI clients | Must | M-05 | Not started | 0 of 4 pass | - | - |
| F-39 | Authentication events and anomaly signals | Should | M-05 | Not started | - | - | - |
| F-40 | Module registry and per-tenant enablement | Must | M-06 | Not started | 0 of 3 pass | - | - |
| F-41 | Plans, entitlements and usage metering | Must | M-06 | Not started | 0 of 4 pass | - | - |
| F-42 | Feature flags | Should | M-06 | Not started | - | - | - |
| F-43 | Trial, expiry and subscription lifecycle | Should | M-06 | Not started | - | - | - |
| F-44 | Signed licence file | Later | M-06 | Not started | - | - | - |
| F-45 | Pack pinning and upgrades | Later | M-06 | Not started | - | - | - |
| F-46 | Workflow definitions and instances | Must | M-06 | Not started | 0 of 3 pass | - | - |
| F-47 | Guards, stage requirements, actions and explanations | Must | M-06 | Not started | 0 of 4 pass | - | - |
| F-48 | SLA timers and stuck-instance sweeper | Must | M-06 | Not started | 0 of 3 pass | - | - |
| F-49 | Approvals | Must | M-06 | Not started | 0 of 3 pass | - | - |
| F-50 | Workflow tooling | Should | M-06 | Not started | - | - | - |
| F-51 | Notices and consent | Must | M-07 | Not started | 0 of 3 pass | - | - |
| F-52 | Data-request desk | Must | M-07 | Not started | 0 of 3 pass | - | - |
| F-53 | Retention engine | Must | M-07 | Not started | 0 of 3 pass | - | - |
| F-54 | Erasure, export and tenant exit | Must | M-07 | Not started | 0 of 3 pass | - | - |
| F-55 | Incident log and breach clocks | Must | M-07 | Not started | 0 of 3 pass | - | - |
| F-56 | Data inventory report | Should | M-07 | Not started | - | - | - |
| F-57 | Blob storage port and file model | Must | M-07 | Not started | 0 of 3 pass | - | - |
| F-58 | Secure upload and download | Must | M-07 | Not started | 0 of 4 pass | - | - |
| F-59 | Document types and expiry tracking | Must | M-07 | Not started | 0 of 3 pass | - | - |
| F-60 | Malware scan and derivatives | Should | M-07 | Not started | - | - | - |
| F-61 | File quotas and integrity | Should | M-07 | Not started | - | - | - |
| F-62 | Design tokens and themes | Must | M-08 | Not started | 0 of 4 pass | - | - |
| F-63 | Component library | Must | M-08 | Not started | 0 of 4 pass | - | - |
| F-64 | Application shell and page templates | Must | M-08 | Not started | 0 of 3 pass | - | - |
| F-65 | Data tables, charts and secure data display | Must | M-08 | Not started | 0 of 4 pass | - | - |
| F-66 | Design quality gates | Must | M-08 | Not started | 0 of 4 pass | - | - |
| F-67 | Tenant branding with contrast guard | Should | M-08 | Not started | - | - | - |

## Tasks (current milestone only)
| ID | Feature | Task | State | Blocked by |
|----|---------|------|-------|-----------|
| T-001 | F-01 | K0-T01 Decide stack and repo layout (ADR-0006) | Done | - |
| T-002 | F-01 | K0-T02 Workspace skeleton | Done | - |
| T-003 | F-02 | K0-T03 Core types | Done | - |
| T-004 | F-02 | K0-T04 Structured logging with redaction by classification and correlation propagation | In review | T-003 |
| T-005 | F-03 | K0-T05 Migration framework | Done | - |
| T-006 | F-03 | K0-T06 Test kit | Not started | T-003, T-005 |
| T-007 | F-04 | K0-T07 Manifest schema and validator CLI per docs/architecture/module-manifest.md | Done | - |
| T-008 | F-04 | K0-T08 Boundary lint | Not started | T-002, T-007 |
| T-009 | F-04 | K0-T09 Public-API diff and semver gate | Done | - |
| T-010 | F-05 | K0-T10 CI pipeline | Not started | T-006, T-008, T-009 |
| T-011 | F-01 | K0-T11 One-command local environment | Not started | - |
| T-012 | F-06 | K0-T12 Sandbox host app | Not started | T-002, T-014 |
| T-013 | F-06 | K0-T13 Observability baseline | Not started | T-004, T-012 |
| T-014 | F-02 | K0-T14 Core ports with in-memory fakes | Done | - |

## Decisions needed from the client
| ID | Decision | Needed by | Impact if late |
|----|----------|-----------|----------------|
| D-05 | OAuth server: build or delegate (direction set: delegate to Supabase Auth; confirm checks first) | before K2-T15 | AI connectors blocked |
| D-06 | Workflow engine: in-house or adopt | before K5-T01 | Workflow engine blocked |
| D-07 | Licence and IP model for client custom builds | before K3-T09 | None now; K3-T09 is Later |
