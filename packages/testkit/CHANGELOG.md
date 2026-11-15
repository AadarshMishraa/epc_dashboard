# Changelog

Notable changes to `@gx/testkit`. Versions follow semver over the public API in `src/index.ts`.

## Unreleased

## 0.2.0 (2026-11-15)

### Added

- `FrozenClock` (K0-T06): a core `Clock` that moves only through `advance(ms)` (wall and monotonic time together) and `setWallTime(ms)` (wall time only, to prove durations never read the wall clock).
- `runTenantMatrix`, `TableSeed` and `SeedContext`: discovers every relation in the non-system schemas, then checks from the catalog and probes across two tenants (see the README). Catalog checks: `tenant_id NOT NULL`, enabled and forced row-level security, an applicable policy and a restrictive one, no ownership by the connection, no superuser or `BYPASSRLS` membership, protected partition children, `security_invoker` views, exempted materialized views and foreign tables, an unreachable ledger schema (or, with `schemas` given, no reachable table outside the list), and an optional `touch` seed step that tests the UPDATE policy when `tenant_id` is immutable (`update-untested` without it). Behaviour probes: read, filtered and unfiltered update and delete, move, cross-tenant insert, and no-tenant read and insert, with a seed that separates parent rows from the single-insert row so a parent's refusal cannot hide a child's loose policy. A table without a policy, a tenant table without a seed, an unlisted table without `tenant_id`, a stale exemption and an empty discovery all fail.
- `checkPoolLeak` and `PoolLeakTarget`: proves the tenant does not outlive its transaction on a reused connection (alternating, failing and concurrent calls), checks user, role and `search_path` against a clean baseline, and reports a pool that never reuses a connection as inconclusive.
- `assertIsolation`, `IsolationFailure`, `IsolationReport`, `IsolationViolation`, `SqlExecutor`, `SqlResult`: the shared report and the minimal SQL interface (a `pg` client satisfies it, so testkit has no runtime dependency on `pg`).
- The shared fixtures are public: `TENANT_A`, `TENANT_B`, `USER_1`, `USER_2`, `FIXTURE_MILLIS`, `contextFor`, `contextWithoutTenant`.

## 0.1.0 (2026-11-05)

### Added

- In-memory fakes for the core ports (K0-T14): `FakeAuthorizer`, `FakeEntitlementGate`, `FakeQuotaProvider`, `FakeClassificationLookup`, `FakeTenantSecretsProvider`, `FakePlatformSecretsProvider`, `FakeAuditSink`, `FakeEventPublisher`, `FakeMessageSender`, `FakeEraserRegistry`. They start empty, so they deny. Seeding is explicit. `failWith` and `failNext` inject failures.
- Adapter-agnostic contract suites, one per port (`authorizerContract` and the others), plus `ContractSuite`, `ContractCase`, `ContractViolation`, `AdapterFactory`, `TenantReader`, `SecretsUnderTest`, and the fixture ids `CONTRACT_TENANTS` and `CONTRACT_USERS`. The fakes pass them, and real adapters (K1 to K8) must run the same suites over empty storage.
- Package skeleton: public-API file, register entry, README and changelog (K0-T02).
