# K1 Tenancy and isolation

Make tenant isolation automatic and provable, so no module can leak data across tenants by forgetting a filter.

- **Wave:** 1
- **Package:** `k1-tenancy`
- **Needs:** K0
- **Tasks:** 12

Status: tick a task when its done-when and tests pass and the definition of done in [README](README.md) holds. Scope and acceptance live in [the PRD](../../prd/01-prd.md); the execution rules are in [the playbook](../README.md).

## Contract

- **Data:** tenant, tenant_domain, tenant_setting, org_unit, support_session
- **Offers:** TenantContext, TenantResolver, TenantProvisioner, ConnectionRouter
- **Uses:** EventPublisher, AuditSink, QuotaProvider (core ports)
- **Events:** tenant.created, tenant.suspended, tenant.reactivated, tenant.archived, tenant.deletion_scheduled, tenant.deleted, support_session.started, support_session.ended
- **Extension points:** Resolver strategies; connection-router adapters; extra settings keys declared through K4

## Features delivered

- **F-07** Tenant lifecycle and typed settings (Must, 4 acceptance criteria)
- **F-08** Fail-closed tenant isolation (Must, 4 acceptance criteria)
- **F-09** Tenant resolution (Must, 3 acceptance criteria)
- **F-12** Silo routing (Later, 0 acceptance criteria)
- **F-10** Organisation units and scope (Must, 3 acceptance criteria)
- **F-11** Quota and rate-limit enforcement points (Must, 3 acceptance criteria)
- **F-13** Support access sessions (Should, 0 acceptance criteria)

### Capabilities

- [MVP] Tenant lifecycle: provision with defaults, suspend, reactivate, archive, scheduled delete
- [MVP] Mandatory tenant context that fails closed
- [MVP] Row-level security helper: tenant_id column, forced RLS, restrictive policy, composite foreign keys
- [MVP] Tenant resolution by subdomain, custom domain or token claim
- [MVP] Organisation units (company, branch, team) and scope resolution (own, team, branch, tenant)
- [MVP] Typed tenant settings: region, timezone, currency, locale, fiscal-year start, branding tokens
- [MVP] Quota and rate-limit enforcement hooks (values come from K3)
- [MVP] Demo and sandbox tenants with deterministic seed and reset
- [v1] Silo routing: a dedicated database or region per tenant by configuration only
- [v1] Support access sessions: time-boxed, reasoned, consented, fully audited

### Failure modes and guards

- **Query runs without a tenant:** Context is mandatory and fails closed; no default tenant exists
- **Owner or superuser bypasses RLS:** App role is not the table owner and has no BYPASSRLS; RLS is forced
- **Row points at another tenant's row:** Composite foreign keys on (tenant_id, id)
- **Tenant setting leaks across pooled connections:** Tenant is set per transaction; pool-leak test in CI
- **Job or event has no tenant:** Envelopes require a tenant; the worker restores context before running
- **Noisy neighbour:** Quotas, rate limits and per-tenant fairness (K6)
- **Support access abused:** Time box, mandatory reason, tenant consent policy, every action audited

## Security baseline for this module

Applies to every task below, on top of [the security guidelines](../../guidelines/security-guidelines.md).

- Tenant context is mandatory and fails closed; no default tenant exists.
- Every tenant table has forced row-level security, a restrictive policy and composite foreign keys; the app role is not the owner and has no BYPASSRLS.
- Unknown or suspended tenants get the same generic response; no tenant names or counts appear in errors.
- Add a negative cross-tenant test for every new table and every new query path.

## Tasks

- [ ] **K1-T01** (T-015) Tenant data model: tenant, tenant_domain, tenant_setting; states active, suspended, archived, deleting (S)
  - Feature: F-07 | Milestone: M-02 | Level: 3 | Lane: k1-tenancy
  - Needs: K0-T05 (T-005)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S2. Module security baseline applies.
  - Done when: Migration applies; invalid state transitions are rejected
  - Tests: unit tests of the state machine
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K1-T02** (T-016) Tenant context: withTenant, requireTenant; propagation across request, job and event (M)
  - Feature: F-08 | Milestone: M-02 | Level: 3 | Lane: k1-tenancy
  - Needs: K0-T03 (T-003)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: code path runs without tenant. Control: requireTenant throws TENANT_REQUIRED; context survives async hops; test with background jobs.
  - Done when: Data layer without a context throws; context survives HTTP, job and event stubs
  - Tests: propagation tests; missing-context test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K1-T03** (T-017) Database roles and RLS helper: non-owner app role, tenant table creator with forced restrictive policy and composite foreign keys, tenant set per transaction (M)
  - Feature: F-08 | Milestone: M-02 | Level: 4 | Lane: k1-tenancy
  - Needs: K1-T01 (T-015), K1-T02 (T-016), K0-T05 (T-005)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S3. Threat: RLS bypass through owner role, missing policy or pooled-connection setting leak. Control: non-owner role, forced RLS, set-local per transaction, pool-leak test.
  - Done when: A table made with the helper isolates tenants; the owner without context sees zero rows
  - Tests: cross-tenant read and write attempts fail
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K1-T04** (T-018) Tenant matrix and pool-leak test wired into CI (S)
  - Feature: F-08 | Milestone: M-02 | Level: 5 | Lane: k1-tenancy
  - Needs: K1-T03 (T-017), K0-T06 (T-006)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S2. Module security baseline applies.
  - Done when: A table without tenant_id or policy fails CI; tenant A then B on one connection never leaks
  - Tests: seeded bad table; pool-leak test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K1-T05** (T-019) Tenant resolver: subdomain, custom domain, token claim; cache; unknown tenant gets a generic 404 (M)
  - Feature: F-09 | Milestone: M-02 | Level: 4 | Lane: k1-tenancy
  - Needs: K1-T01 (T-015)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: tenant enumeration and host-header spoofing. Control: generic 404, allow-list of domains, claim and host must agree.
  - Done when: Each strategy resolves; a spoofed header is ignored
  - Tests: unit and integration tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K1-T06** (T-020) Silo routing: connection router for shared pool or dedicated database and region; per-target migrations (M)
  - Feature: F-12 | Milestone: M-02 | Level: 5 | Lane: k1-tenancy
  - Needs: K1-T05 (T-019), K0-T05 (T-005)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S3. Threat: routing sends one tenant to another's database. Control: routing table is signed or admin-only, audited, and verified by a canary query.
  - Done when: Two tenants on two databases by configuration only; migrations apply to both
  - Tests: integration test with two databases
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K1-T07** (T-021) Tenant lifecycle: provision with defaults, suspend, reactivate, archive, scheduled delete; events through the core port (M)
  - Feature: F-07 | Milestone: M-02 | Level: 4 | Lane: k1-tenancy
  - Needs: K1-T01 (T-015), K0-T14 (T-014)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: Suspended tenants cannot sign in or run jobs; every transition emits an event
  - Tests: lifecycle tests with fake publisher
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K1-T08** (T-022) Organisation units: company, branch, team hierarchy; scope resolver for own, team, branch, tenant (M)
  - Feature: F-10 | Milestone: M-02 | Level: 5 | Lane: k1-tenancy
  - Needs: K1-T03 (T-017)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Resolver returns the right sets, including after a unit moves
  - Tests: scope-matrix tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K1-T09** (T-023) Typed tenant settings: region, timezone, currency, locale, fiscal-year start, branding tokens (S)
  - Feature: F-07 | Milestone: M-02 | Level: 4 | Lane: k1-tenancy
  - Needs: K1-T01 (T-015)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Settings validate and emit change events
  - Tests: validation tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K1-T10** (T-024) Quota and rate-limit enforcement points using the core QuotaProvider (S)
  - Feature: F-11 | Milestone: M-02 | Level: 4 | Lane: k1-tenancy
  - Needs: K1-T02 (T-016), K0-T14 (T-014)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency
  - Security: S2. Module security baseline applies.
  - Done when: With a fake provider, limits are enforced; defaults are safe
  - Tests: unit tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K1-T11** (T-025) Support access sessions: time-boxed, reasoned, consented, audited (M)
  - Feature: F-13 | Milestone: M-02 | Level: 4 | Lane: k1-tenancy
  - Needs: K1-T02 (T-016), K0-T14 (T-014)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: silent or open-ended operator access. Control: reason, tenant consent policy, hard expiry, read-only by default, every action audited.
  - Done when: Session expires; actions tagged as support; scope cannot exceed the grant
  - Tests: expiry and escalation tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K1-T12** (T-026) Demo tenant seeding and reset (S)
  - Feature: F-07 | Milestone: M-02 | Level: 5 | Lane: k1-tenancy
  - Needs: K1-T07 (T-021)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: One command creates a deterministic demo tenant and resets it
  - Tests: seed idempotency test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
