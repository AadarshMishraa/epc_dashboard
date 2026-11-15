# @gx/testkit

Test kit: tenant matrix runner, adapter contract harness, frozen clock, fixtures and pool-leak helper.

- Plan: [K0 brief](../../docs/plans/001-foundation/K0-core.md), wave 0. Support package in the core lane (not a module).
- Register id: `testkit` in [packages/register.json](../register.json).
- Status: fakes and contract suites for the core ports (K0-T14); frozen clock, fixtures, tenant matrix runner and pool-leak helper (K0-T06).
- Test-only: depend on it from `devDependencies`. The import-graph check rejects runtime code that imports a development dependency.

## Public API

One file, `src/index.ts`, exported as `@gx/testkit`. Other packages import only that name: deep imports are blocked by the `exports` map and by `pnpm check:imports`.

| Export | What it is |
|---|---|
| `FakeAuthorizer`, `FakeEntitlementGate`, `FakeQuotaProvider`, `FakeClassificationLookup`, `FakeTenantSecretsProvider`, `FakePlatformSecretsProvider` | In-memory policy fakes. They start empty, so they deny. Seed them through the constructor or through `grant`, `enable`, `setLimit`, `define` and `set`. `failWith(error)` makes calls fail |
| `FakeAuditSink`, `FakeEventPublisher`, `FakeMessageSender`, `RecordingFakeOptions` | Recording fakes, read back per tenant with `records`, `published` and `sent`. `failNext(error)` fails the next call and stores nothing |
| `FakeEraserRegistry` | In-memory registry: it refuses duplicate ids and reports every handler's outcome through `runEraser` |
| `authorizerContract`, `entitlementGateContract`, `quotaProviderContract`, `classificationLookupContract`, `secretsProviderContract`, `auditSinkContract`, `eventPublisherContract`, `messageSenderContract`, `eraserRegistryContract` | One adapter-agnostic contract suite per port. Run each one against the fake and against every real adapter |
| `AuthorizerSeed`, `EntitlementSeed`, `QuotaSeed`, `ClassificationSeed`, `SecretsSeed`, `AuditSinkUnderTest`, `EventPublisherUnderTest`, `MessageSenderUnderTest` | What a suite's factory receives or returns |
| `ContractSuite`, `ContractCase`, `ContractViolation`, `AdapterFactory`, `TenantReader`, `SecretsUnderTest` | The harness types. A case throws `ContractViolation` when the adapter breaks the contract |
| `CONTRACT_TENANTS`, `CONTRACT_USERS` | The fixture ids the suites use. A database adapter creates these rows before the suites run |
| `FrozenClock` | A core `Clock` that only moves when told: `advance(ms)` moves wall and monotonic time, `setWallTime(ms)` only wall time |
| `runTenantMatrix`, `TableSeed`, `SeedContext`, `TenantMatrixOptions`, `TenantMatrixReport` | Discovers tables and proves tenant isolation on a real Postgres (see below) |
| `checkPoolLeak`, `PoolLeakTarget`, `PoolLeakOptions`, `PoolLeakReport` | Proves the tenant does not outlive its transaction on a reused connection |
| `assertIsolation`, `IsolationFailure`, `IsolationReport`, `IsolationViolation`, `SqlExecutor`, `SqlResult` | The shared report type, the thrower, and the minimal SQL interface a `pg` client satisfies |
| `TENANT_A`, `TENANT_B`, `USER_1`, `USER_2`, `FIXTURE_MILLIS`, `contextFor`, `contextWithoutTenant` | The fixture ids, the fixed instant and a ready `TenantContext` |
| `MODULE_ID` | This package's register id, `testkit` |

### Running a contract suite against an adapter

```ts
import { authorizerContract } from '@gx/testkit';
import { describe, it } from 'vitest';

const suite = authorizerContract(async (seed) => createSeededAuthorizer(seed));
describe(`${suite.port} contract`, () => {
  for (const c of suite.cases) it(c.name, c.run);
});
```

Each factory call must return an adapter over empty storage, so a database adapter truncates its tables in the factory or in `afterEach`. The suites are plain data, so testkit has no runtime dependency on a test runner. The register refuses `testkit` in a module's runtime `depends`. `src/fakes.test.ts` also checks that each suite rejects a deliberately broken adapter.

### Tenant matrix

```ts
import { assertIsolation, runTenantMatrix } from '@gx/testkit';

const report = await runTenantMatrix({
  sql: appRoleClient, // one connection as the application role: not the owner, no BYPASSRLS
  seeds: {
    'public.k1_branch': {
      // A table with parents also gives `parents`; `row` is exactly one INSERT. If the role may not
      // update tenant_id, also give `touch`: one unfiltered UPDATE of another column to a constant.
      row: async (sql, { tenantId, nonce }) => {
        await sql.query('INSERT INTO k1_branch (tenant_id, name) VALUES ($1, $2)', [tenantId, nonce]);
      },
    },
  },
  exempt: { 'public.k1_region': 'platform-wide list of regions, no tenant data' },
});
assertIsolation(report); // throws IsolationFailure listing every violation
```

- Run it on a disposable, fully migrated database. Seeded rows stay, every run uses fresh unique `nonce` values, and a second run on a database with foreign keys can fail on them (the violation says so).
- By default it checks every non-system schema except `gx_migrations` (override with `schemas` or `ignoreSchemas`), so a table in an unlisted schema cannot be missed. The application role must have no privilege on the ignored schemas.
- **Structure (catalog):** `tenant_id NOT NULL`; row-level security enabled and forced; a policy that applies to the connection and at least one `RESTRICTIVE` one (security-guidelines 4.1); the connection neither owns the table nor is, or belongs to, a superuser or `BYPASSRLS` role. Partition children the role can reach need their own forced RLS and policy (RLS is not inherited). Views need `security_invoker`; materialized views and foreign tables cannot carry RLS, so they need an `exempt` entry with a reason.
- **Behaviour (seeded row per tenant):** as tenant A, a read sees only A's rows (and at least one); filtered and unfiltered updates and deletes change no more rows than A can read; moving rows to B and inserting a row for B are refused; with no tenant set nothing is readable or insertable. Both filtered and unfiltered statements run because a SELECT policy hides other tenants' rows from any statement with a `WHERE` clause; only a bare statement meets the UPDATE and DELETE policies.
- The runner sets the tenant the way production does (`set_config('app.tenant_id', ..., true)`, transaction-local, ADR-0002), probes in transactions it rolls back, and checks that the backend stays the same (pass one connection, not a pool).
- Tables are probed referenced-first so a bare `DELETE` is not stopped by a foreign key. A rerun on a database that already holds child rows fails on that key; the violation says to use a fresh database.
- If the application role may not update `tenant_id`, every probe that writes it is refused for want of a grant and never reaches the UPDATE policy. The runner then reports `update-untested` unless the seed has a `touch` step, which it compares with the readable row count like the other unfiltered probes.
- With `schemas` given, any table the role can reach in another schema fails as `unscanned-schema`.
- A check that cannot run is a violation, never a skip. A cross-tenant insert counts as refused only for SQLSTATE `42501`; any other error is reported as inconclusive.
- Checks named in violations: `tenant-column`, `tenant-not-null`, `rls-enabled`, `rls-forced`, `policy`, `restrictive-policy`, `owner`, `role`, `connection`, `partition`, `view`, `ignored-schema`, `unscanned-schema`, `update-untested`, `seed`, `exempt`, `discovery`, `read`, `visibility`, `update`, `delete`, `move`, `insert`, `no-context`.
- Known gaps: TD-16.

### Pool-leak check

Give `checkPoolLeak` a `PoolLeakTarget` wrapping the application's tenant-scoped entry point on a pool of size 1: `runAs(tenantId, work)` and `runWithoutTenant(work)`. It alternates tenants, makes the work throw, and runs both tenants concurrently; every read of `app.tenant_id` must show the caller's own tenant or nothing, and the user, `role` and `search_path` seen with no tenant must match a clean baseline taken first. `runWithoutTenant` must be a raw checkout (no `RESET` or `DISCARD`), or it hides the leak. With a pool of one connection the concurrent phase is serialised: it still checks the order of calls, not true parallelism.

## Depends on

`@gx/core`

## Tests

```
pnpm vitest run --project testkit                                  # unit tests, no database
GX_TEST_DATABASE_URL=postgres://... pnpm test:db                   # also the matrix and pool-leak self-tests
```

The self-tests need a Postgres where the URL's role can create databases and roles (each test gets its own).
