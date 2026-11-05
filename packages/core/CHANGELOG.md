# Changelog

Notable changes to `@gx/core`. Versions follow semver over the public API in `src/index.ts`.

## Unreleased

## 0.1.1 (2026-11-05)

### Added

- Structured logging with redaction (K0-T04, F-02, threat model `docs/security/threat-models/K0-T04-logging.md`):
  - `createLogger(context, { sink, classification?, minLevel?, maxLineChars?, onFailure? })` returns a frozen `Logger` (`debug`, `info`, `warn`, `error`) bound to one context. Each call writes one JSON line to a `LogSink` port with `ts`, `level`, `event`, `tenant_id`, `correlation_id`, `causation_id`, `actor` and `initiated_by`, which callers cannot override; their fields sit under `fields`.
  - Event keys must be dotted snake_case, otherwise the line says `log.invalid_event`. Control characters, U+2028 and U+2029 are escaped, so a payload cannot forge a line.
  - A call that names an entity is classified through `classifyField`: `personal` becomes `[personal]`, `sensitive_personal` and `secret` become `[redacted]`, and an unknown field or a missing lookup counts as secret.
  - The backstop (`redactValue`, `redactString`) runs on every value and key. It masks Indian phone numbers, emails, UPI ids, PAN, GSTIN, long numbers such as bank accounts and cards, bearer and basic credentials, JSON web tokens, and URL query and fragment values. A national id number is removed entirely (CMP-03). UUIDs are kept. Values under secret-looking keys (`isSecretKey`) are removed.
  - Errors and `cause` values are summarised by type and code (`summariseError`), never by message, detail or stack. `Secret` prints `[secret]`.
  - The walker never calls getters, `toJSON` or `toString`. It caps depth, breadth, cause chains and string length (`REDACTION_LIMITS`) and marks cycles.
  - The logger never throws. A line it cannot build becomes a fallback line with the ids and `redaction_failed: true`, and sink and lookup failures go to `onFailure`.

### Fixed

- `isAllowed` and `denialReason` read own properties only, so a polluted `Object.prototype.allow` or `reason` can no longer turn an adapter's denial into an allow (cross-check of K0-T14, 2026-11-05).

## 0.1.0 (2026-11-05)

### Added

- Core ports (K0-T14, threat model `docs/security/threat-models/K0-T14-core-ports.md`). Every port fails closed:
  - Decisions are tagged unions (`Decision`, `ALLOW`, `deny`), never booleans. `isAllowed` accepts only `allow === true`.
  - `Authorizer` with `authorize`, `AUTHORIZATION_DENIALS`, `actorModeDenial` (anonymous callers are denied, operators only read, AI clients need the exact scope).
  - `EntitlementGate` with `checkEntitlement` (an unknown key is denied).
  - `QuotaProvider` with `consumeQuota`, `QuotaUse`, `isQuotaAmount` and `isIdempotencyKey`. An unknown quota is exhausted. An amount must be a safe integer of at least 1. Every use carries an idempotency key: a replay returns the first grant, and reusing a key for a different use is `KEY_REUSED`.
  - `ClassificationLookup` with `classifyField` and `CLASSIFICATIONS` (an unknown field is `secret`).
  - `TenantSecretsProvider`, `PlatformSecretsProvider` and `Secret`. These are two separate ports, so tenant secret access never reaches platform keys. Tenant secrets are keyed by tenant. A `Secret` prints `[secret]` through `String`, JSON and `util.inspect`.
  - `AuditSink`, `prepareAuditEntry`, `createAuditRecord` (frozen records; tenant, actor and correlation id come from the context).
  - `EventPublisher`, `prepareEvent`, `createEventEnvelope`, `toFrozenJson` (the tenant comes from the context; the payload is copied and frozen).
  - `MessageSender`, `prepareMessage`, `maskRecipient` (purpose and consent reference are required; the recipient is masked).
  - `EraserRegistry`, `ErasureResult`, `runEraser`, `isErasureComplete`, `isEraserHandlerId`. A duplicate id is refused, and an erase with no handlers is not complete. A handler may report `retained` with a legal basis, and a retention without a basis is a failure. Handlers must be idempotent.
  - The `authorize`, `checkEntitlement` and `consumeQuota` guards turn a throw or a malformed answer into a denial that keeps the cause. `authorize` denies an anonymous caller without asking the adapter. `actorModeDenial` denies unknown actor kinds and non-array scopes.
  - Audit records and event envelopes keep their own frozen copy of the actor. `toFrozenJson` caps the total node count and turns throwing getters or proxies into `VALIDATION_FAILED`. `maskRecipient` also masks the email domain, except its last label.
- Package skeleton: public-API file, register entry, README and changelog (K0-T02).
- Core types (K0-T03): `Context` with tenant, actor, correlation and causation ids and clock; `requireTenant` (fails closed); `Actor` including AI clients acting for a user; validated `CorrelationId`; `Id` with an ordered UUIDv7 generator; `Clock`; `Result`; the error catalogue with `toErrorResponse`.
