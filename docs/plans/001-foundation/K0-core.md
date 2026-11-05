# K0 Core and toolchain

The shared contracts every package uses, and the tools that keep the foundation honest and extractable.

- **Wave:** 0
- **Package:** `core + testkit + toolchain`
- **Needs:** none
- **Tasks:** 14

Status: tick a task when its done-when and tests pass and the definition of done in [README](README.md) holds. Scope and acceptance live in [the PRD](../../prd/01-prd.md); the execution rules are in [the playbook](../README.md).

## Contract

- **Data:** No business tables. A migration ledger per package.
- **Offers:** All core ports above, each with a fake and a contract test suite.
- **Uses:** None; core has no dependencies.
- **Events:** None.
- **Extension points:** Adapters for every port.

## Features delivered

- **F-01** Stack decision, workspace and local environment (Must, 3 acceptance criteria)
- **F-02** Core contracts, ports and redacted logging (Must, 3 acceptance criteria)
- **F-03** Migration framework and test kit (Must, 4 acceptance criteria)
- **F-04** Manifest, boundary and API gates (Must, 4 acceptance criteria)
- **F-05** CI pipeline with security gates (Must, 4 acceptance criteria)
- **F-06** Sandbox host and observability baseline (Must, 4 acceptance criteria)

### Capabilities

- [MVP] Context (tenant, actor, correlation id, clock) carried through requests, jobs and events
- [MVP] Ordered unique ids; stable error codes; one Result and Error model
- [MVP] Core ports with in-memory fakes: EventPublisher, AuditSink, Authorizer, EntitlementGate, QuotaProvider, ClassificationLookup, SecretsProvider, MessageSender, EraserRegistry, Clock
- [MVP] Structured logging with redaction by data classification; metrics and tracing hooks
- [MVP] Migration framework: package-namespaced, forward-only, expand then contract
- [MVP] Test kit: tenant matrix, adapter contract harness, frozen clock, fixtures, pool-leak helper
- [MVP] Manifest schema and validator; layering and boundary lint; public-API diff; CI pipeline
- [MVP] Sandbox host app and one-command local environment

### Failure modes and guards

- **Core becomes a dumping ground:** No I/O and no business nouns in core; a size and import budget is reviewed each release
- **Fakes drift from real adapters:** The same contract suite runs against the fake and every real adapter

## Security baseline for this module

Applies to every task below, on top of [the security guidelines](../../guidelines/security-guidelines.md).

- No secret, key or personal data in the repository, fixtures or logs; secrets come only through SecretsProvider.
- Pin and lock dependencies; the build fails on known critical advisories and on committed secret patterns.
- Fakes must fail closed: the fake Authorizer denies by default, the fake EntitlementGate denies unknown keys.

## Tasks

- [x] **K0-T01** (T-001) Decide stack and repo layout (ADR-0006) (S)
  - Feature: F-01 | Milestone: M-01 | Level: 0 | Lane: core
  - Needs: none
  - Agents: build Aadarsh decides, then gx-implementer | tests - | review module gate
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-architecture
  - Security: S1. Module security baseline applies.
  - Done when: ADR accepted by Aadarsh: language, framework, Postgres version, queue approach, package manager, monorepo layout
  - Tests: review only
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
  - Human gate: Done: ADR-0006 accepted 2026-11-04. Postgres major version pinned to 17 (Supabase platform default, 2026-11-04) in supabase/config.toml, CI and local. Supabase and Vercel are configured with placeholders (docs/operations/environments.md); Aadarsh creates both projects in Mumbai, confirms the project shows Postgres 17, and adds the keys before the first deploy or hosted migration.
- [x] **K0-T02** (T-002) Workspace skeleton: one package per module with public-API file, register entry, README, changelog (M)
  - Feature: F-01 | Milestone: M-01 | Level: 1 | Lane: core
  - Needs: K0-T01 (T-001)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: Workspace builds; every package imports only core
  - Tests: build and import-graph check
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [x] **K0-T03** (T-003) Core types: Context, ordered ids, error codes, Result, Clock (M)
  - Feature: F-02 | Milestone: M-01 | Level: 2 | Lane: core
  - Needs: K0-T02 (T-002)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: Context carries tenant, actor, correlation id; error catalogue published; no I/O in core
  - Tests: unit tests; property tests for ids
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K0-T04** (T-004) Structured logging with redaction by classification and correlation propagation (S)
  - Feature: F-02 | Milestone: M-01 | Level: 3 | Lane: core
  - Needs: K0-T03 (T-003)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: personal data leaks through logs. Control: redact by classification before write; summarise AppError.cause by type and code, never serialise it raw (driver messages can hold personal data); test with seeded phone, email and ID values.
  - Done when: Phone, email and ID patterns are masked in logs; correlation id on every line
  - Tests: log-redaction test with seeded personal data
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [x] **K0-T05** (T-005) Migration framework: package-namespaced, forward-only, expand then contract, dependency-ordered (M)
  - Feature: F-03 | Milestone: M-01 | Level: 2 | Lane: core
  - Needs: K0-T02 (T-002)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S1. Module security baseline applies.
  - Done when: Empty database reaches head; a destructive step without a contract marker is rejected
  - Tests: migrate-from-empty; destructive-step rejection test
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K0-T06** (T-006) Test kit: tenant matrix runner, adapter contract harness, frozen clock, fixtures, pool-leak helper (M)
  - Feature: F-03 | Milestone: M-01 | Level: 3 | Lane: core
  - Needs: K0-T03 (T-003), K0-T05 (T-005)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S1. Module security baseline applies.
  - Done when: Runner discovers tables and fails on a table without a policy
  - Tests: runner self-test on a deliberately bad table
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [x] **K0-T07** (T-007) Manifest schema and validator CLI per docs/architecture/module-manifest.md (M)
  - Feature: F-04 | Milestone: M-01 | Level: 2 | Lane: core
  - Needs: K0-T02 (T-002)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S1. Module security baseline applies.
  - Done when: Valid sample passes; undeclared event, tool without mode or missing permission fails; an error code that collides with core or another module fails
  - Tests: validator tests with good and bad manifests
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K0-T08** (T-008) Boundary lint: no upward imports, no cross-package internals, table ownership, no industry words (M)
  - Feature: F-04 | Milestone: M-01 | Level: 3 | Lane: core
  - Needs: K0-T02 (T-002), K0-T07 (T-007)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S1. Module security baseline applies.
  - Done when: Seeded violations of each kind fail CI
  - Tests: one failing fixture per rule
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [x] **K0-T09** (T-009) Public-API diff and semver gate (S)
  - Feature: F-04 | Milestone: M-01 | Level: 2 | Lane: core
  - Needs: K0-T02 (T-002)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: Removing an exported symbol without a major bump fails CI
  - Tests: fixture package with a breaking change
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K0-T10** (T-010) CI pipeline: lint, unit, contract, tenant matrix, migrate-from-previous, boundary lint, privacycheck, dependency scan (M)
  - Feature: F-05 | Milestone: M-01 | Level: 4 | Lane: core
  - Needs: K0-T06 (T-006), K0-T08 (T-008), K0-T09 (T-009)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-ops-readiness
  - Security: S3. Threat: vulnerable or tampered dependency, leaked secret. Control: lockfile, advisory scan, secret scan, pinned CI actions, no secrets in CI logs.
  - Done when: Required checks block merge; pipeline green on main
  - Tests: deliberately broken branch is blocked
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K0-T11** (T-011) One-command local environment: database, object-storage emulator, mail sink, seed (S)
  - Feature: F-01 | Milestone: M-01 | Level: 1 | Lane: core
  - Needs: K0-T01 (T-001)
  - Agents: build gx-implementer | tests - | review module gate
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S1. Module security baseline applies.
  - Done when: New developer boots with one documented command
  - Tests: smoke script in CI
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K0-T12** (T-012) Sandbox host app: composition root that boots from the foundation alone; health endpoint; lists registered modules (M)
  - Feature: F-06 | Milestone: M-01 | Level: 4 | Lane: core
  - Needs: K0-T02 (T-002), K0-T14 (T-014)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: Boots with only foundation packages; health ok
  - Tests: boot test in CI
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K0-T13** (T-013) Observability baseline: metrics and tracing hooks, readiness and liveness, request correlation middleware (S)
  - Feature: F-06 | Milestone: M-01 | Level: 5 | Lane: core
  - Needs: K0-T04 (T-004), K0-T12 (T-012)
  - Agents: build gx-implementer | tests - | review module gate
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-ops-readiness
  - Security: S1. Module security baseline applies.
  - Done when: Metrics scrape works locally; every request has a correlation id
  - Tests: integration test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [x] **K0-T14** (T-014) Core ports with in-memory fakes: EventPublisher, AuditSink, Authorizer, EntitlementGate, QuotaProvider, ClassificationLookup, SecretsProvider, MessageSender, EraserRegistry (M)
  - Feature: F-02 | Milestone: M-01 | Level: 3 | Lane: core
  - Needs: K0-T03 (T-003)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: a fake or port that fails open. Control: deny-by-default fakes; contract suite proves denial on missing permission, key or classification.
  - Done when: Each port has an interface, a fake and a contract test suite
  - Tests: contract suites pass on fakes
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
