# K3 Entitlements and module registry

Control which modules, limits and features each tenant has, so one codebase is both a subscription product and a custom build.

- **Wave:** 4
- **Package:** `k3-entitlements`
- **Needs:** K4, K6
- **Tasks:** 11

Status: tick a task when its done-when and tests pass and the definition of done in [README](README.md) holds. Scope and acceptance live in [the PRD](../../prd/01-prd.md); the execution rules are in [the playbook](../README.md).

## Contract

- **Data:** module_install, plan, entitlement, tenant_override, usage_counter, feature_flag, flag_rule, subscription_state, licence
- **Offers:** ModuleRegistry, EntitlementService (implements core EntitlementGate and QuotaProvider), UsageMeter, FeatureFlags, LicenceVerifier
- **Uses:** TenantContext, EventPublisher, Expr from K4
- **Events:** entitlement.changed, limit.reached, trial.expiring, trial.expired, module.enabled, module.disabled
- **Extension points:** SubscriptionProvider adapters; meters declared by modules; entitlement keys declared in manifests

## Features delivered

- **F-40** Module registry and per-tenant enablement (Must, 3 acceptance criteria)
- **F-41** Plans, entitlements and usage metering (Must, 4 acceptance criteria)
- **F-42** Feature flags (Should, 0 acceptance criteria)
- **F-43** Trial, expiry and subscription lifecycle (Should, 0 acceptance criteria)
- **F-44** Signed licence file (Later, 0 acceptance criteria)
- **F-45** Pack pinning and upgrades (Later, 0 acceptance criteria)

### Capabilities

- [MVP] Module registry: installed modules, versions, dependency check at boot
- [MVP] Per-tenant module enablement, applied to routes, menus, AI tools and jobs through one check
- [MVP] Plans and entitlements: boolean, limit and metered; per-tenant overrides with expiry
- [MVP] Entitlement check with cache, event invalidation and a failure policy per key
- [MVP] Usage metering: idempotent record, aggregation windows, limit-reached events
- [v1] Feature flags with rules (tenant list, percentage, attribute) and a kill switch
- [v1] Trial, expiry and grace with a read-only degradation mode
- [v1] Subscription provider port with a stub adapter
- [v1] Signed licence file for silo and custom deployments with offline verification
- [v1] Pack pinning and upgrade orchestration hooks
- [v1] Headless admin API for plans, overrides and usage

### Failure modes and guards

- **Stale cache grants access after a downgrade:** Short TTL plus invalidation on entitlement.changed
- **Metering double counts:** Idempotency key per record
- **Entitlement service is down:** Per-key policy: fail closed for paid features and money, fail open for read-only basics
- **A licence is copied to another deployment:** Licence binds to deployment id and expiry; tamper test
- **Disabled module leaves data exposed:** Disable hides and blocks; data stays; removal is a migration with export

## Security baseline for this module

Applies to every task below, on top of [the security guidelines](../../guidelines/security-guidelines.md).

- Entitlement checks fail closed for security-relevant keys; the per-key failure policy is explicit and tested.
- Admin interfaces require platform-operator permissions and are audited; overrides carry an expiry and a reason.
- Licence verification is offline, signature-checked and rejects downgrade and clock rollback.

## Tasks

- [ ] **K3-T01** (T-045) Module registry: installed modules, versions, dependency check at boot (M)
  - Feature: F-40 | Milestone: M-06 | Level: 5 | Lane: k3-entitlements
  - Needs: K0-T07 (T-007), K1-T03 (T-017)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Boot fails with a clear error on a missing or cyclic dependency
  - Tests: boot tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K3-T02** (T-046) Per-tenant module enablement applied to routes, menus, AI tools and jobs through one check (M)
  - Feature: F-40 | Milestone: M-06 | Level: 6 | Lane: k3-entitlements
  - Needs: K3-T01 (T-045)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: A disabled module is unreachable everywhere
  - Tests: gating tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K3-T03** (T-047) Plans and entitlements: boolean, limit, metered; per-tenant overrides with expiry (M)
  - Feature: F-41 | Milestone: M-06 | Level: 6 | Lane: k3-entitlements
  - Needs: K3-T01 (T-045)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Plan plus override resolves to the expected value
  - Tests: resolution tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K3-T04** (T-048) Entitlement check API with cache, event invalidation and per-key failure policy; implements core EntitlementGate and QuotaProvider (M)
  - Feature: F-41 | Milestone: M-06 | Level: 8 | Lane: k3-entitlements
  - Needs: K3-T03 (T-047), K6-T04 (T-084)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: stale or bypassed limits. Control: event-based invalidation, per-key failure policy, fail closed for security keys, tests under store outage.
  - Done when: A downgrade takes effect within the TTL or on event; failure policy is honoured
  - Tests: cache and fault tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K3-T05** (T-049) Usage metering: idempotent record, windows, limit-reached events (M)
  - Feature: F-41 | Milestone: M-06 | Level: 8 | Lane: k3-entitlements
  - Needs: K3-T03 (T-047), K6-T04 (T-084)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency
  - Security: S2. Module security baseline applies.
  - Done when: Replaying a record counts once
  - Tests: idempotency test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K3-T06** (T-050) Feature flags: tenant list, percentage, attribute rules using expr; kill switch (M)
  - Feature: F-42 | Milestone: M-06 | Level: 9 | Lane: k3-entitlements
  - Needs: K4-T08 (T-063), K3-T04 (T-048)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: The kill switch overrides everything
  - Tests: rule tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K3-T07** (T-051) Trial, expiry and grace lifecycle with read-only degradation (S)
  - Feature: F-43 | Milestone: M-06 | Level: 7 | Lane: k3-entitlements
  - Needs: K3-T03 (T-047), K6-T08 (T-088)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: An expired tenant becomes read-only, not locked out
  - Tests: lifecycle tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K3-T08** (T-052) Subscription provider port and stub adapter (S)
  - Feature: F-43 | Milestone: M-06 | Level: 7 | Lane: k3-entitlements
  - Needs: K3-T03 (T-047)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Stub drives plan changes through the port
  - Tests: contract suite
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K3-T09** (T-053) Signed licence file for silo and custom deployments, offline verification (M)
  - Feature: F-44 | Milestone: M-06 | Level: 7 | Lane: k3-entitlements
  - Needs: K3-T03 (T-047)
  - Agents: build Aadarsh decides, then gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-architecture
  - Security: S3. Threat: forged or replayed licence. Control: asymmetric signature, offline verification, expiry, tenant binding, clock-rollback detection.
  - Done when: A tampered or expired licence is refused
  - Tests: tamper and expiry tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
  - Human gate: Decide Q-07 (licence and IP model) with counsel before code. gx-planner drafts; Aadarsh decides.
- [ ] **K3-T10** (T-054) Pack pinning and upgrade orchestration with dry-run and rollback (M)
  - Feature: F-45 | Milestone: M-06 | Level: 8 | Lane: k3-entitlements
  - Needs: K3-T02 (T-046), K4-T12 (T-067)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Upgrade shows the diff first and can roll back
  - Tests: upgrade tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K3-T11** (T-055) Headless admin API for plans, overrides, usage (S)
  - Feature: F-41 | Milestone: M-06 | Level: 9 | Lane: k3-entitlements
  - Needs: K3-T05 (T-049)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Authorised callers can read and change entitlements; changes are audited
  - Tests: API tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
