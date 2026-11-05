# @gx/testkit

Test kit: tenant matrix runner, adapter contract harness, frozen clock, fixtures and pool-leak helper.

- Plan: [K0 brief](../../docs/plans/001-foundation/K0-core.md), wave 0. Support package in the core lane (not a module).
- Register id: `testkit` in [packages/register.json](../register.json).
- Status: fakes and contract suites for the core ports (K0-T14). The tenant matrix runner, frozen clock, fixtures and pool-leak helper arrive with K0-T06.
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

## Depends on

`@gx/core`

## Tests

```
pnpm vitest run --project testkit
```
