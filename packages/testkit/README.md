# @gx/testkit

Test kit: tenant matrix runner, adapter contract harness, frozen clock, fixtures and pool-leak helper.

- Plan: [K0 brief](../../docs/plans/001-foundation/K0-core.md), wave 0. Support package in the core lane (not a module).
- Register id: `testkit` in [packages/register.json](../register.json).
- Status: fakes, contract suites, frozen clock and context fixtures (K0-T14). The tenant matrix runner, adapter harness helpers and pool-leak helper arrive with K0-T06.

## Public API

One file, `src/index.ts`, exported as `@gx/testkit`. Test-only: list it in `devDependencies` (and the register's `devDepends`); the import-graph check rejects it in runtime code, so a fake can never ship.

| Export | What it is |
|---|---|
| `fakeAuthorizer`, `fakeEntitlementGate`, `fakeQuotaProvider`, `fakeClassificationLookup`, `fakeSecretsProvider`, `fakeAuditSink`, `fakeEventPublisher`, `fakeMessageSender`, `inMemoryEraserRegistry` | Deny-by-default fakes for the nine core ports. They start empty and are seeded explicitly; the record-keeping fakes accept `failNext(error)` |
| `authorizerContract`, `entitlementGateContract`, `quotaProviderContract`, `classificationLookupContract`, `secretsProviderContract`, `auditSinkContract`, `eventPublisherContract`, `messageSenderContract`, `eraserRegistryContract` | Contract suites. Every real adapter must pass the same suite as its fake |
| `frozenClock` | Moves only when told to; wall time can step back while monotonic time cannot |
| `tenantContext`, `testId`, `testTenant`, `TEST_CORRELATION` | Fixture builders for a checked `TenantContext` and readable ids |

Running a contract suite against an adapter:

```ts
import { authorizerContract } from '@gx/testkit';
authorizerContract('postgres authorizer', async (seed) => createPgAuthorizer(await seedGrants(seed)));
```

## Depends on

`@gx/core`

## Tests

```
pnpm vitest run --project testkit
```
