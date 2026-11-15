# Threat model: K0-T04 structured logging with redaction by classification

- Task: K0-T04 (T-004), feature F-02, security level S3. Written by gx-security-reviewer on 2026-11-12, before any code. It revises the model of 2026-11-04 in this file (see git history), which assumed a walker over nested objects; this design allows scalar values only.
- Brief threat: personal data leaks through logs. Control: redact by classification before write; summarise `AppError.cause` by type and code, never serialise it raw; test with seeded phone, email and ID values (F-02-AC3). Every line carries correlation id and tenant (F-02-AC1).
- What was checked: `context.ts`, `errors.ts`, `ids.ts`, `ports/classification.ts`, `ports/secret.ts`, `ports/json.ts`, `ports/messages.ts`; security guidelines sections 2 and 4.8; register rules CMP-03, CMP-05, CMP-16. No code existed; every claim about behaviour is a requirement, not an observation.

## Scope and assets

In scope: `createLogger`, `classified()`, `summariseError()`, the string scrubber and the line serialiser in `@gx/core` (pure, no I/O, writes to an injected sink). Assets:

- personal and sensitive personal values (phones, emails, UPI ids, PAN, 12-digit national id numbers, card and account numbers);
- secrets (tokens, OTPs, passwords, signed URLs);
- the log line's integrity (tenant, actor and correlation attribution used in support and incident work);
- availability of the calling code.

## Trust boundaries

- Untrusted input to log fields: request values, driver errors, client-chosen correlation ids and AI client ids.
- Module code to logger: in-process and trusted, but `Context` is an interface, so a hand-built object can skip `createContext`. OBSERVED: `context.ts` validates only inside `parseCorrelationId` and `parseTenantId`.
- Logger to sink to log store and its processor: host-owned, outside core.
- Log readers (operators, support, a log vendor) to tenant data.

## Design requirements

1. **Envelope.** Fields go under a nested `fields` object, never merged at the top level, so a field named `tenant_id`, `correlation_id` or `level` cannot overwrite the envelope. Output objects are built without a prototype.
2. **Re-check the context when writing.**
   - `tenant_id`, actor ids and `causation_id` go through `isId`; `correlation_id` goes through `parseCorrelationId`. A failure writes `[invalid]` and is counted.
   - The actor summary is an allow-list projection (kind plus named ids), never a spread.
   - `system.process` must match an identifier pattern, else a marker. It is not merely scrubbed.
   - AI client ids are scrubbed and lose their query string and fragment. OBSERVED: their pattern allows `?&=%`.
3. **Strict `isAppError` guard.** An error counts as an AppError only if it has all five: a code matching the catalogue code pattern, a status in `ERROR_STATUSES`, a boolean `retryable`, a `fields` array and a string `message`. A Postgres error carries `code` and `detail` ("Key (email)=(...)"), and its `detail` must never be read. `AppError.fields[].path` is scrubbed and capped at 20 entries, because paths can embed input keys.
4. **Scrubber input.**
   - Digits are Unicode `\p{Nd}`, so Devanagari and full-width digits count.
   - Separators are any Unicode whitespace (including NBSP), `\p{Pd}` dashes, dot, slash and parentheses.
   - Format characters (`\p{Cf}`, zero-width) are removed before scanning.
   - `%40` is treated as `@`.
   - The email rule does not require a dot in the domain, so UPI ids such as `name@okaxis` are caught.
5. **Country-neutral default patterns.**
   - The query string and fragment of any `scheme://` token become `[query]`.
   - `Bearer <x>` and JWT-shaped tokens (`eyJ` followed by three dot-separated segments) become `[secret]`.
6. **Event names and keys.**
   - Event segments start with a letter.
   - Keys must match `^[a-z][a-z0-9_]{0,63}$` (lower snake case only, so the deny list can split them reliably).
   - An event or key that the scrubber would change is rejected and counted, not written.
7. **Size limits.** 2,048 characters per string before scrubbing, 1,024 after, 64 fields, and a total line budget of 8 KB. Fields past the budget are dropped and counted. Some shippers split lines at 16 KB (INFERRED: Docker json-file), which breaks one-JSON-object-per-line.
8. **The logger never throws.** If the clock throws or returns NaN, write `ts: null` and count it. Reads of the `fields` object are guarded in case it is a Proxy. Exceptions from `onSinkError` are caught. A re-entry guard stops an `onSinkError` that logs through the same logger from recursing. If redaction itself fails, a fallback line carries level, event, tenant, correlation id and `redaction_failed: true`, with no payload.
9. **Key-name deny list** (second layer; applies to string and number values only, so `phone_verified: true` survives).
   - Secret: password, passwd, pwd, secret, token, otp, pin, jwt, bearer, session, signature, salt, authorization, cookie, credential, api_key, private_key, signing_key, access_key, encryption_key.
   - Sensitive personal: the 12-digit national id name, pan, account_number, card_number.
   - Personal: phone, mobile, email, address, dob, ip, upi, vpa, first_name, last_name, full_name.
10. **No way to switch redaction off.** No raw or unsafe option and no environment switch. Redaction is the same at every level, debug included.
11. **Escape more characters.** After `JSON.stringify`, also escape bidi controls (U+202A to U+202E, U+2066 to U+2069) alongside U+2028 and U+2029.
12. **Unrecognised wrappers.** A `classified()` wrapper the logger does not recognise (for example from a duplicate copy of the package) becomes `[omitted:object]`.

## Threats, controls and tests

Seed corpus (fixed, used by T3, T4 and T6): phones in ASCII, spaced, hyphenated, dotted, with country code, in Devanagari and full-width digits, with a zero-width space and with a no-break space; emails with a tag, in capitals, with `%40`, and a UPI id; a 12-digit id in groups of four, a 16-digit card shape, a PAN shape and a GSTIN shape.

Assertion for every seed: the line does not contain the seed, and the line with non-digits removed does not contain the seed's digits. A frozen clock at epoch 0 and fixed UUIDs keep this check free of accidental matches.

| ID | Threat | Control | Test (vitest) |
|---|---|---|---|
| T1 | A personal, sensitive or secret classified value is written | `classified()` → `classifyField` → full-mask tokens | Fake lookup with one field per class; the line has the 3 tokens and no seed |
| T2 | An unknown field or a failing lookup is treated as public | `classifyField` fails closed to secret; counted | Unknown field, throwing lookup, lookup returning `'PUBLIC'`: each gives `[secret]`; failures are counted |
| T3 | Personal data in free text through any channel (F-02-AC3) | Scrubber on every written string | Corpus × channels: unclassified field value, internal classified value, `AppError.detail`, `fields[].path`, `system.process`, AI client id, foreign error code |
| T4 | Unicode or obfuscated digits get past the scrubber | Requirement 4 | Devanagari, full-width, zero-width and NBSP phone forms all give `[number]` |
| T5 | False positives destroy record ids and dates | UUIDs and ISO-8601 values protected first | A UUID, `2026-11-12T10:30:00.000Z` and `1234567` survive; `id=<uuid> ph=<phone>` masks only the phone |
| T6 | Raw cause or driver message leaks | `summariseError` with requirement 3 | Postgres-shaped `{code:'23505', detail:'Key (email)=(...)', message:'...'}` as a cause and as a thrown value: only the type and `code:'23505'` appear; an object with `code`, `status` and `detail` but no `retryable` is treated as foreign |
| T7 | A hostile error shape breaks logging | Guarded property reads; depth 3 | Revoked Proxy; throwing `constructor` getter; `a.cause = a` stops at depth 3; constructor name with a newline gives `Unknown`; a 10-digit code is dropped |
| T8 | A request body or object is dumped | Scalar values only | Object, array, Map, Date, `new String()`, bigint, symbol and function each give `[omitted:<type>]`; `Secret` gives `[secret]` |
| T9 | A shapeless secret or a phone passed as a number | Deny list (requirement 9) | A password, a refresh token, a numeric OTP and a numeric mobile are masked; `phone_verified:true` is kept; a test documents the limit: a 10-digit number under the key `contact` is written as is |
| T10 | Secrets inside URLs or headers | Requirement 5 | A callback URL keeps host and path and masks the query and fragment; a Bearer JWT is masked; an AI client URL id with `?token=` is masked |
| T11 | A field overwrites the envelope (log forging) | Requirement 1 | `fields:{tenant_id, correlation_id, level}`: top-level values are the context's; the forged values appear only under `fields` |
| T12 | A hand-built context carries data or a wrong tenant | Requirement 2 | Context literal with an email as correlation id, a phone as tenant id and an actor with an extra property: `[invalid]` markers, a count, no seed |
| T13 | Line injection or text that misleads a log viewer | JSON serialiser plus requirement 11 | A value with a newline and a forged object, an ANSI escape, U+2028 and U+202E: no raw newline or raw U+2028, U+2029 or U+202E in the output; `JSON.parse` round-trips |
| T14 | An event name or key carries data | Requirement 6 | Events with a space and digits, with 10 digits in a segment, capitalised, and 129 characters long give the marker; keys `__proto__`, one with 10 digits and a camelCase one are dropped and counted |
| T15 | Denial of service through size, field count or slow scrubbing | Requirement 7; linear scanner | 1 MB string gives `[omitted:too_long]`; 100 fields give 64 plus a dropped count; worst-case line ≤ 8,192 bytes; adversarial `'1 '.repeat(1024)` and `'a@'.repeat(1024)` stay inside a time budget |
| T16 | The logger throws into business code | Requirement 8 | Throwing sink: `onSinkError` is called once and the log call returns; throwing `onSinkError` is swallowed; an `onSinkError` that logs again does not recurse; clock throwing or NaN gives `ts:null`; a `fields` Proxy with throwing `ownKeys` still writes a line |
| T17 | A line is missing tenant or correlation id (F-02-AC1) | Envelope always built from the context | 50 lines across user, user via AI client, service account, operator, system and anonymous actors, with and without a tenant: all 50 have `correlation_id` and a `tenant_id` key (null when there is no tenant) |
| T18 | Redaction is bypassed by level or option | Requirement 10 | The same seeded call at debug and at error is redacted identically; the options type has no raw or unsafe switch |

## Residual risks accepted

- **Personal data with no shape** in free text is not caught: names, addresses, passport and voter-id numbers (7 digits), 6-digit OTPs inside `detail`. Only classification, review and the CMP-16 `privacycheck` rule catch these.
- **Numbers under keys the deny list does not name** are written as is (T9 documents the limit).
- **False positives are accepted:** IPv4 addresses, amounts of 8 or more digits held as strings, epoch seconds held as strings, and digit runs inside hex digests are masked.
- **Record ids still identify people.** User and tenant UUIDs in logs are linkable personal data (INFERRED, under DPDP). Log retention and access control are a host duty.
- **Code structure is visible.** Constructor names and stack frames show internal structure to log readers.

## Rulings

- **(a) Stack frames are allowed** for non-AppError thrown values and causes only. Lines are picked by the frame grammar, not by dropping the first line, because messages can span several lines. Each frame is scrubbed and capped, at most 10 frames, read inside a guard. Reason: an INTERNAL error cannot be debugged without frames, and V8 frames carry no argument values (INFERRED).
- **(b) Write the correlation id as is,** after re-checking its format at write time. It is the support lookup key the client quotes back. Condition for K0-T13: the public entry point never adopts a client-supplied id. It generates its own and may log the inbound one as an ordinary scrubbed field.
- **(c) The 8-digit threshold is right.** It catches mobiles (10 digits), local landlines (8), 12-digit national ids, cards (13 to 19) and account numbers (9 to 18); 7 would mask millisecond durations and byte counts. Keep the PAN shape in the core default list, tightened to `[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z]` and matched inside tokens, because a sole proprietor's GSTIN embeds a personal PAN. Defaults cannot be removed: a false mask is cheap, a missed PAN is a leak. Passport, voter-id and vehicle-number shapes belong to the host or pack, because a letter plus 7 digits collides with ordinary codes.
- **(d) Keep the deny list.** It is the only control for shapeless secrets (passwords, random tokens, OTPs) and for phones passed as numbers. The T9 limit test prevents false confidence.
- **(e) Not in core:** the sink, transport, buffering, sampling and rate limits; retention, region and access control on the log store (CMP-05); error-tracker integration, which must reuse `summariseError`; inbound correlation trust and access logs with IP and user agent (K0-T13); audit and sensitive-read logging (K7a): logs are not audit; an AsyncLocalStorage wrapper; India patterns other than PAN; alerts on redaction counters; any reveal, unmasking or hashing of values (an unkeyed hash of a phone can be reversed).

## To verify (regulatory, not decided here)

- CMP-05: 1-year log retention in an Indian region, against CERT-In 2022's 180 days, and whether application logs fall under it or only access logs do.
- CMP-16: a DPA with any log vendor, which is a sub-processor, before a vendor sink is wired.
- CMP-03: confirm that logs count as storage for the never-store list.
- DPDP erasure against log retention for pseudonymous ids. `data-inventory.md` needs an "application logs" category.

## Build notes (added by the builder for the final review)

- Host-supplied extra patterns are not built in this task: no caller needs one yet, and leaving them out removes the slow-pattern risk. A pack that needs a shape (passport, voter id) raises it then.
- The timing test for T15 uses a fixed time budget, not a ratio against a benign string, because a ratio is unstable in a shuffled test run.
- T2 counts reported failures: a throwing lookup and a malformed answer. An unknown field answered `secret` by the lookup is the lookup's own answer, so it is masked but not counted as a failure. `classifyField` now reports a malformed answer through `onError`.

## Review outcome (2026-11-12)

gx-security-reviewer reviewed the diff: APPROVE WITH FIXES, no Critical or High. All three Medium findings and the Low findings below were fixed with a test each; the fixes were checked by tests and mutation runs, not by a second review pass.

- M1: a sink that returns a rejecting promise crashed the process. The rejection is now reported to `onSinkError`, and a reporter that logs to a rejecting sink stops after one round.
- M2: the key deny list missed joined-up words (`accesstoken`, `phonenumber`). Long words now match anywhere in the key; short ones still need underscores.
- M3: ruling (b) is tightened. A correlation id that the scrubber would change (a phone number, a tax id shape) is written as `[invalid]`, because ids also arrive on queued jobs.
- L1: text is normalised (NFKC) before scanning; `_ , + ·` join digits; an address run takes the RFC 5322 atom characters and quotes.
- L2 (part): URL user parts become `[credentials]`; the value after `password`, `token`, `secret`, `api_key` or `authorization` becomes `[secret]`.
- L3: a catalogue-shaped error whose code the scrubber would change is treated as foreign; a retry delay of 8 or more digits is dropped.
- L4: a stack line counts as a frame only as `at name (location:line:column)` or as a bare location that starts like a path.
- L6: the line is copied to prototype-less objects before it is serialised.
- L7: a test covers a type name that carries digits.
- Public API: the scrubber and its limits are internal; `summariseError` stays public for error-tracker use.

Still open, accepted for now (also in `docs/maintenance/technical-debt.md`):

- L2 (rest): secrets in a URL path, percent-encoded query separators, and digits joined by a colon are not caught.
- L5: the URL and JWT rules are quadratic inside the 2,048-character cap (under 1 ms per string).
- Stack frames carry absolute file paths; the host should build with stripped paths.
