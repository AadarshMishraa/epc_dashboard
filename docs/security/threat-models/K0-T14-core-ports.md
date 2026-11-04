# Threat model: K0-T14 core ports with in-memory fakes

- Task: K0-T14 (T-014), feature F-02, security level S3. Written by gx-security-reviewer on 2026-11-04, before any code.
- Brief threat: a fake or port that fails open. Control: deny-by-default fakes; contract suites prove denial on a missing permission, key or classification.

## Trust boundaries
Module to port (in-process); tenant to tenant; operator and AI client to tenant; test to production wiring (a fake shipped by mistake); API to secrets store; worker to broker (contract only, adapters later).

## STRIDE

| Threat | Category | Asset | Control | Test that proves it |
|---|---|---|---|---|
| Fake Authorizer allows with an empty grant list or an unknown permission | Elevation | Every action | Empty seed is deny; unknown permission is `deny { reason: 'UNKNOWN_PERMISSION' }` | Contract: no grant gives deny; property: random strings never allow without an explicit grant |
| A thrown error, `undefined` or a boolean from an adapter is read as allow | Elevation | Actions | Decision is a tagged union; `isAllowed` accepts only `{ allow: true }`; `authorize` turns a throw into deny | Fake set to throw: the caller's result is deny |
| AI client with read scope writes; operator writes without consent | Elevation | Tenant data | Authorizer checks `actor.via.scopes` against the permission's mode; operators are read-only by default | `user via { read }` asking for a write is denied |
| Port takes a plain `Context` where a tenant is needed | Information disclosure | Tenant isolation | Tenant-scoped methods take `TenantContext` | `@ts-expect-error` type tests, checked by `tsc` |
| SecretsProvider returns tenant A's secret to tenant B | Information disclosure | Credentials | Keyed by tenant and name; platform secrets are a separate method | Seed A, read as B: `NOT_FOUND`, same shape as missing |
| A secret leaks through `String()`, `JSON.stringify` or inspect | Information disclosure | Credentials | `Secret` class with explicit `reveal()` | All three print `[secret]`; the seeded value is absent |
| EntitlementGate enables an unknown key; QuotaProvider treats an unknown quota as unlimited or accepts NaN or negative amounts | Elevation, Denial of service | Billing, capacity | Unknown is denied or exhausted; amounts are safe integers of at least 1 | Contract cases |
| ClassificationLookup returns nothing for an unknown field and it is treated as Public | Information disclosure | Personal data | Unknown field is the most restrictive class, `secret` | Unknown field gives `secret` |
| AuditSink acknowledges before writing or swallows failures | Repudiation | Audit trail | `append` returns `Result`; stored records are frozen and carry tenant, actor and correlation id | Injected failure reaches the caller; mutating a stored record throws |
| EventPublisher takes the tenant from the payload, or the payload changes after publish | Spoofing, Tampering | Events | Tenant from the context only; payload deep-copied and frozen | Payload `tenantId: B` under context A is stored as A |
| EraserRegistry: a duplicate handler overwrites another; erase succeeds with handlers missing | Repudiation, Tampering | Erasure duty | Duplicate registration rejected; no handlers is a failure; per-handler outcome reported | Contract cases |
| MessageSender sends with no purpose or consent reference | Information disclosure | Recipients | Port requires `purpose` and `consentRef`; the fake stores a masked recipient | Missing `consentRef` is rejected |
| Fakes wired into production | Elevation | Everything | Fakes live in `@gx/testkit`, a test-only dependency; the import-graph check rejects runtime imports of development dependencies | Existing import-graph test "rejects a development tool imported by runtime code" |

## Design decisions
- `Secret` class: `toString`, `toJSON` and `Symbol.for('nodejs.util.inspect.custom')` all return `[secret]`; the value sits in a private field.
- Decisions are tagged unions with reason codes, never booleans.
- Port methods take `TenantContext` unless documented as global.
- Contract suites are adapter-agnostic and live in `@gx/testkit`; real adapters run the same suites.
- Fakes start empty (deny); seeding is explicit.

## Out of scope
Real adapters (K1 to K7), row-level security, the role model and cache invalidation (K2), consent logic (K7b).

## Blocking review, 2026-11-04: findings and controls added
| Finding | Control now | Test |
|---|---|---|
| H1 Audit entry could carry its own `initiatedBy`, tenant or id | Records are built from named fields only | Contract: spoofed tenant, actor, initiatedBy, correlation, id, at and extra keys are all ignored |
| M1 A polluted `Object.prototype.allow` or `enabled` turned a deny into an allow | `authorize`, `isAllowed` and `checkEntitlement` read own properties only | Prototype-pollution test |
| M2 Message store kept extra fields and parameter values | Stored as named fields: masked recipient, parameter names only | Contract: recipient equals `maskAddress`; no number, name, amount or extra key in the store |
| M3 One hanging handler blocked erasure; malformed or partial results counted as done | Handlers run concurrently with a deadline; only a well-formed `ok: true` counts; incomplete runs are `err` (`NO_HANDLERS`, `INCOMPLETE`) | Contract: hang, malformed answer, ok without value, partial failure |
| M4 Grants were not keyed by actor kind | `grantSubject(actor)` gives `kind:id`; operators need a grant even to read | Contract: same id across kinds, service accounts, system processes, ungranted operator |
| M5 Quota concurrency test could not catch a race | Harness gives two instances over one store; 200 concurrent calls | Mutation with a yield between check and write turns it red |
| Low | Short addresses fully masked by code point; unclonable payloads rejected as `VALIDATION_FAILED`; quota seed limits validated; `viaAiClient` fixture validates the id; no fallback between platform and tenant secrets | Unit and contract tests |
