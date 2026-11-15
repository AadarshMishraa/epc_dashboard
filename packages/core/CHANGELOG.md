# Changelog

Notable changes to `@gx/core`. Versions follow semver over the public API in `src/index.ts`.

## Unreleased

## 0.1.1 (2026-11-12)

### Added

- Structured logging with redaction (K0-T04, threat model `docs/security/threat-models/K0-T04-logging.md`):
  - `createLogger` writes one JSON line per event to a sink the host supplies. Every line carries the time, level, event, correlation id, tenant (null when there is none) and an actor summary, all taken from the context and checked again when written. Fields sit under `fields`, so they cannot overwrite these.
  - `classified` ties a value to its field. A personal, sensitive or secret value is written as its class name; a field the lookup does not know is `[secret]`.
  - A text scrubber is the backstop on every string: emails and UPI ids, runs of 8 or more digits in any script, the tax id shape, URL query strings and user parts, bearer and JWT-shaped tokens, and the value after a secret's name are masked. Record ids and ISO dates are kept. The scrubber is internal.
  - Key names such as `password`, `token`, `otp`, `phone` and `email` are masked whatever the value, also inside a longer key.
  - `summariseError` gives a catalogue error's code, status, field problems and scrubbed detail. For any other error and every cause it gives the type name, a short code and stack frames only, never the message.
  - Limits: 64 fields and 8,192 bytes per line (`LOG_MAX_FIELDS`, `LOG_MAX_LINE_BYTES`); a string over 2,048 characters is not written and a written one is cut at 1,024. What is dropped is counted under `problems` on the line.
  - A log call never throws. A sink that throws or rejects is reported to `onSinkError`. There is no option that turns redaction off.

### Changed

- `classifyField` now also calls `onError` when the lookup returns a value that is not a classification. The answer is still `secret`.

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
