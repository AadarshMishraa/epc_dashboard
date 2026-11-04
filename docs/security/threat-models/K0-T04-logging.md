# Threat model: K0-T04 structured logging with redaction

- Task: K0-T04 (T-004), feature F-02, security level S3. Written by gx-security-reviewer on 2026-11-04, before any code.
- Brief threat: personal data leaks through logs. Control: redact by classification before write; test with seeded phone, email and ID values.

## Trust boundaries
Request ingress to logs (untrusted strings); app to log sink and processor (core writes only to a sink port); tenant to tenant and operator to tenant (who reads logs).

## STRIDE

| Threat | Category | Asset | Control | Test that proves it |
|---|---|---|---|---|
| A field classified Personal is logged unmasked | Information disclosure | Personal data | ClassificationLookup is the primary control: Personal masked, Sensitive and Secret removed | Seeded record through the fake lookup |
| Free text holds a phone (+91, 0, 10-digit starting 6 to 9, spaced or hyphenated), email, PAN, GSTIN, UPI id or bank account | Information disclosure | Personal data | Pattern backstop on every string, including `detail` and keys | Table of seeded values; F-02-AC3 |
| An Aadhaar number is partly kept (for example the last 4 digits) | Information disclosure | Sensitive | Removed entirely as `[aadhaar]` (CMP-03) | 12-digit and spaced forms leave no digits |
| Bypass through nested objects, arrays, Map, Set, Error.cause chains, toJSON, getters, Symbol keys, class instances or cycles | Information disclosure | Personal data | Own walker; never calls toJSON before redacting; depth, breadth and cycle caps | Property test over generated shapes, seeded at every position |
| `AppError.cause` logged raw (a duplicate-key message with a phone) | Information disclosure | Personal data | Summarised as `{ type, code }`; code must look like a SQLSTATE; no message or stack; chain depth capped | pg-like error with a phone in its message and nested cause |
| A secret in a URL query, header or cookie | Information disclosure | Credentials | Query values dropped unless allow-listed; key deny-list (authorization, cookie, token, password, otp, signature, body) | `?token=abc&code=1` leaves neither value |
| CRLF or ANSI injection; a payload overrides level, tenant or correlation id | Tampering, Repudiation | Log integrity | One JSON line per event; control characters escaped; reserved keys win | A forged-line payload yields one line with the true correlation id |
| ReDoS or very long strings | Denial of service | Availability | Linear patterns only; per-field and per-line caps before matching | 64 KB adversarial input per pattern inside the budget; truncation marker |
| The redactor throws (hostile getter, revoked Proxy, BigInt) and the line is lost | Denial of service, Repudiation | Observability | Catch and emit a fallback line: level, event, tenant, correlation id, `redaction_failed: true`, no payload | Throwing getter and revoked Proxy cases |
| A line has no tenant or correlation id | Repudiation | Traceability | Logger bound from the context; no global logger | F-02-AC1: 50 sampled lines |
| An unkeyed hash of a phone is reversible (about 10^10 values) | Information disclosure | Personal data | Type tokens only, never hashes | No hex digest appears |

## Design decisions
- Structured calls only: `log.info('event.key', fields)`, with the event key matching `^[a-z0-9_.]+$`; no pre-formatted messages.
- Classification from ClassificationLookup; patterns and the key deny-list are backstops.
- Redaction runs in-process before the sink; the sink never sees raw values.
- A `Secret` always serialises as `[secret]`.

## Out of scope
Log store, retention and access control; tracing and metrics (K0-T13); audit (K7a); browser and error-tracker logging (must reuse this redactor later).

## To verify with counsel or the register
Aadhaar must never be logged or stored (CMP-03); log retention of 1 year in an Indian region (CMP-05) against CERT-In 2022's 180 days; a DPA with any log processor before a vendor sink (CMP-16); data-inventory classes for UPI ids and bank accounts (CMP-27 says a consumer's bank account is never collected).

## Gaps found in existing code
- `packages/core/src/errors.ts`: `AppError.detail` is "without personal data" by comment only. The pattern backstop must cover `detail`.
- `packages/core/src/context.ts`: AI client ids allow `?&=%`, so a URL-form id could carry query secrets into logs; apply the URL query rule to that field.
