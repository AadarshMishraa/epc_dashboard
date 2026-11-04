# @gx/core

Shared contracts: context, ids, errors, Result, Clock and the core ports with in-memory fakes. No I/O and no dependencies.

- Plan: [K0 brief](../../docs/plans/001-foundation/K0-core.md), wave 0. Layer L0 module.
- Register id: `core` in [packages/register.json](../register.json).
- Status: core types from K0-T03. Ports with in-memory fakes (K0-T14) and redacted logging (K0-T04) are next.

## Public API

One file, `src/index.ts`, exported as `@gx/core`. Other packages import only that name: deep imports are blocked by the `exports` map and by `pnpm check:imports`.

| Export | What it is |
|---|---|
| `Context`, `TenantContext`, `createContext`, `deriveContext`, `requireTenant` | Tenant, actor, initiating actor, correlation id, causation id and clock, passed explicitly through requests, jobs and events. Tenant-scoped code takes a `TenantContext`, which only `requireTenant` produces (fails closed with `TENANT_REQUIRED`; there is no default tenant). `deriveContext` keeps the original actor as `initiatedBy` when a system process takes over |
| `Actor`, `AiClient`, `AiClientId`, `AiClientScope`, `parseAiClientId` | User (optionally via an AI client with read or write scope, ADR-0005), service account, support operator, system process, anonymous. Ids only, so actors are safe to log; client ids are validated |
| `CorrelationId`, `parseCorrelationId`, `correlationIdFromId` | Accepts 1 to 128 characters of `[A-Za-z0-9._:-]` from untrusted input, so an id cannot inject log lines |
| `Id`, `isId`, `parseId`, `TenantId`, `parseTenantId` | Canonical lowercase UUIDs (Postgres `uuid`); `TenantId` is a separate brand so no other id passes as a tenant |
| `createIdGenerator`, `idTimestamp`, `RandomBytes`, `webCryptoRandomBytes` | UUIDv7 (RFC 9562, counter method): strictly ordered per generator, even within a millisecond or when the clock steps back |
| `Clock`, `systemClock`, `nowDate` | The only source of time: wall time (`nowMillis`) for timestamps, monotonic time (`monotonicMillis`) for durations; tests use the frozen clock from `@gx/testkit` |
| `Result`, `Ok`, `Err`, `ok`, `err` | Expected failures as values; unexpected faults are thrown |
| `CORE_ERRORS`, `defineErrorCatalogue`, `appError`, `coreError`, `AppError`, `FieldError`, `ErrorDefinition`, `ErrorStatus`, `ERROR_STATUSES`, `CoreErrorCode`, `AppErrorOptions` | The error catalogue: stable code, HTTP status, plain public message, retryable flag. `detail` and `cause` are for logs only |
| `toErrorResponse`, `ErrorResponseBody` | The API error body `{ error: { code, message, fields, correlation_id, retry_after_seconds?, current_version? } }`; nothing else leaves the server |
| `moduleId`, `isModuleId`, `ModuleId`, `MODULE_ID_MAX_LENGTH` | Validated, branded register and manifest ids |
| `MODULE_ID` | This package's register id, `core` |

### Core error codes

| Code | Status | Retryable |
|---|---|---|
| `VALIDATION_FAILED` | 400 | no |
| `UNAUTHENTICATED` | 401 | no |
| `FORBIDDEN`, `TENANT_REQUIRED`, `ENTITLEMENT_REQUIRED` | 403 | no |
| `NOT_FOUND` | 404 (also for other tenants' records) | no |
| `CONFLICT` | 409 | no |
| `UNPROCESSABLE`, `IDEMPOTENCY_KEY_REUSED` | 422 | no |
| `RATE_LIMITED` | 429 | yes |
| `INTERNAL` | 500 | no |
| `DEPENDENCY_UNAVAILABLE` | 503 | yes |

Modules define their own codes with `defineErrorCatalogue`, and their manifests declare them (K0-T07).

### No I/O

Core builds without Node.js type definitions, and the register marks it `isolated`, so a dependency or a `node:` import outside tests fails `pnpm check:imports`. Time and randomness are passed in.

## Depends on

Nothing: core has no dependencies.

## Tests

```
pnpm vitest run --project core
```
