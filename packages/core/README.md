# @gx/core

Shared contracts: context, ids, errors, Result, Clock, the core ports and redacted structured logging. No I/O and no dependencies.

- Plan: [K0 brief](../../docs/plans/001-foundation/K0-core.md), wave 0. Layer L0 module.
- Register id: `core` in [packages/register.json](../register.json).
- Status: core types from K0-T03; core ports from K0-T14 (their fakes and contract suites are in `@gx/testkit`); redacted logging from K0-T04.

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

### Ports (K0-T14)

Each port is an interface that a later module implements. The in-memory fake and the contract suite for each one are in `@gx/testkit`. Every port fails closed (threat model `docs/security/threat-models/K0-T14-core-ports.md`). Tenant-scoped methods take a `TenantContext`, so a plain `Context` does not compile.

| Port | Implemented by | Fails closed how |
|---|---|---|
| `Authorizer`, through `authorize` | K2 | An unknown permission, no grant, an anonymous caller, an operator writing or an AI client beyond its scope is denied with a reason. `actorModeDenial` is the shared actor check |
| `EntitlementGate`, through `checkEntitlement` | K3 | An unknown key is `UNKNOWN_KEY`, never included |
| `QuotaProvider`, through `consumeQuota` | K3 | An unknown quota is exhausted. An amount must be a safe integer of at least 1. A use over the limit consumes nothing. Each use has an idempotency key, so a replay consumes nothing more. Units are returned by consuming inside the action's transaction |
| `ClassificationLookup`, through `classifyField` | K4 | An unknown field is `secret`. It is synchronous, for log redaction |
| `TenantSecretsProvider`, `PlatformSecretsProvider`, `Secret` | adapter per host | Another tenant's secret is `NOT_FOUND`, the same answer as a missing one. Platform secrets are a separate port, wired only where needed. `Secret` prints `[secret]` and only `reveal()` returns the value |
| `AuditSink`, `prepareAuditEntry`, `createAuditRecord` | K7a | A failure is returned, never swallowed. Records are frozen, and tenant, actor and correlation id come from the context |
| `EventPublisher`, `prepareEvent`, `createEventEnvelope`, `toFrozenJson` | K6 | The tenant comes from the context, never the payload. The payload is plain JSON, copied and frozen |
| `MessageSender`, `prepareMessage`, `maskRecipient` | K2 and a provider adapter | Purpose and consent reference (or legal basis) are required. The send record keeps a masked recipient only |
| `EraserRegistry`, `runEraser`, `isErasureComplete`, `isEraserHandlerId` | K7b | A duplicate id is refused. An erase with no handlers is not complete. Every handler's outcome is reported. Data kept under a law is `retained` with its basis, never silent. Handlers must be idempotent |

Decisions are tagged unions (`Decision`, `Allow`, `Deny`, `ALLOW`, `deny`), never booleans. `isAllowed` accepts only `allow === true`. The guards turn a throw or a malformed answer into `DenyOnError`, which keeps the `cause` for logs.

### Logging (K0-T04)

```ts
const logger = createLogger({ sink: (line) => process.stdout.write(line + '\n'), classification });
logger.info(context, 'order.approved', {
  fields: { order_id: order.id, contact: classified({ entity: 'supplier', field: 'phone' }, phone) },
});
logger.error(context, 'order.sync_failed', { error });
```

One JSON object per line: `ts`, `level`, `event`, `module`, `correlation_id`, `tenant_id`, `actor`, `initiated_by`, `causation_id`, `fields`, `error`, `problems`. The host owns the sink, the log store, its retention and who may read it. Threat model: `docs/security/threat-models/K0-T04-logging.md`.

| Rule | What happens |
|---|---|
| Context | Tenant, actor and correlation id come from the `Context` on every call and are checked again; a bad value is written as `[invalid]`, and so is a correlation id that looks like a phone number or an id. There is no global logger |
| Event | A dotted lower_snake_case name of at most 128 characters. No free-text messages |
| Fields | Flat, lower_snake_case keys, scalar values. An object or array is written as `[omitted:object]` or `[omitted:array]`, so a request body cannot be dumped |
| Classified values | `classified(field, value)`: public and internal values are written, the rest become `[personal]`, `[sensitive_personal]` or `[secret]`. An unknown field is `[secret]` |
| Text backstop | A scrubber runs on every string: `[email]`, `[number]` (8 or more digits in any script), `[id]`, `[query]`, `[credentials]`, `[secret]`. It cannot see a name or an address, so pass personal data through `classified` or leave it out. It is internal to core |
| Key names | `password`, `token`, `otp`, `session`, `phone`, `mobile`, `email`, `address` and similar are masked whatever the value, also inside a longer key (`accesstoken`). Short words (`pin`, `ip`, `pan`, `dob`) must stand between underscores. A key the list does not name is not covered |
| Errors | `summariseError`: code, status, field problems and scrubbed `detail` for a catalogue error. Type name, short code and stack frames for anything else, never its message |
| Limits | 64 fields and 8,192 bytes per line; what is dropped is counted under `problems` |
| Failure | A log call never throws. A sink that throws, or returns a promise that rejects, is reported to `onSinkError` |

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
