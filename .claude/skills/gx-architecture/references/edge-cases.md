# Backend data checks and edge cases (run per endpoint / function)

## Input
- [ ] Missing, null, empty string, whitespace-only, very long, unicode/emoji, RTL, mixed Hindi/English
- [ ] Numbers: 0, negative, decimals where integers expected, huge values, `NaN`, numbers sent as strings with commas ("1,20,000")
- [ ] Dates: past, far future, invalid (31 Feb), timezone-less, DST (other zones), end of month, financial-year boundary (31 Mar / 1 Apr)
- [ ] Enums: unknown value, wrong case, deprecated value from an old client
- [ ] IDs: non-existent, deleted (soft), belonging to another tenant, belonging to another user in the same tenant
- [ ] Phone/email/GSTIN/PAN/PIN: format, duplicates, normalisation (+91, spaces, case)
- [ ] Files: wrong type with right extension, zero bytes, too large, duplicate upload, password-protected PDF/Excel

## State
- [ ] Action on a record in the wrong state (approve an already approved, cancel a completed)
- [ ] Stale client: record changed since the user loaded it (version conflict)
- [ ] Concurrent: two requests at the same time for the same record / slot / balance
- [ ] Duplicate: same request twice (double-tap, network retry) → idempotency
- [ ] Partial failure: step 2 of 3 failed; what state is left? Can it resume or roll back?
- [ ] Parent deleted while child operation in flight; cascading effects on reports

## Identity and permission
- [ ] Unauthenticated, expired token, revoked user, user removed from tenant mid-session
- [ ] Role change takes effect without re-login (or is documented not to)
- [ ] Cross-tenant access attempt via every id parameter (negative test)
- [ ] Field-level: can a lower role read cost/margin/personal fields through any endpoint, export or realtime channel?

## Volume and time
- [ ] Empty collection, one item, page boundary, 10,000+ items, export of everything
- [ ] Slow downstream (DB, provider) → timeout behaviour and user message
- [ ] Provider down → queued, retried, user told; nothing lost
- [ ] Job runs twice / runs late / overlaps with itself
- [ ] Clock: server vs client time differences; scheduled tasks across midnight IST vs UTC

## Clients
- [ ] Old mobile app version calling the new API (fields removed/renamed? new required fields?)
- [ ] Offline then online: queued writes replayed in order, conflicts handled
- [ ] App killed mid-flow; deep link into a page that needs state

## Output
- [ ] Response contains only fields the caller may see; no internal ids/secrets/stack traces
- [ ] Error shape is consistent and has a stable machine code + human message
- [ ] Money and dates formatted on the client from raw values, not pre-formatted strings
- [ ] Audit log entry for every change to important data (who, what, when, before/after)
