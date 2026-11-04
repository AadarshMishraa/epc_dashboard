# Spikes, limits and degradation

## Know the shape
A launch is not average traffic times ten. It is the whole audience arriving in the first 60 seconds, all asking for the same few rows. Plan for **peak concurrent claimants per hot unit** and **claims per second**, not daily users.
Back-of-envelope: peak claims/s x average claim transaction time (ms)/1000 = connections busy. If that exceeds your pool, you queue or fail. Measure the claim transaction (keep it under ~20 ms), then size from numbers.

## Admission control (waiting room)
- Put a queue in front of the booking flow for known spikes: users get a position and an estimated wait; you admit at a rate the claim path can take (for example N sessions per second), each admission is a signed, short-lived token.
- Queueing is a feature. A crashed site is not. Use a CDN/edge waiting-room product or a simple token bucket on a cached endpoint.
- Fairness: random draw within the first minute beats raw speed (bots win speed contests). Say which rule you use.
- Bot defence on the entry point (challenge, device/account age, per-identity caps), not on every request.

## Rate limits
Per user, per IP, per device, per route; strictest on hold, pay, OTP, coupon. Return 429 with `Retry-After`. Shape limits for shared IPs (offices, mobile carriers) so real users are not blocked. Limits live at the edge/gateway plus a server-side check on money paths.

## Read/write separation
- Cacheable: listings, show pages, static seat layout, price lists (seconds to minutes).
- Near-real-time: seat availability map. Cache 1-3 s, or serve from a counter/materialised view, or push deltas. A seat shown free that turns out taken is acceptable; a seat sold twice is not.
- Authoritative: hold, pay, confirm, cancel, refund always hit the primary.
- Never use a read replica for a check that precedes a write.

## Database health
Pool through PgBouncer/Supabase pooler (transaction mode: no session state, no advisory session locks). Set `statement_timeout`, `lock_timeout` (fail fast beats a pile-up), `idle_in_transaction_session_timeout`. Index the claim path; `EXPLAIN` it with realistic row counts and a hot-row scenario. Watch lock waits, dead tuples on hot tables (tune autovacuum), replication lag.

## Degrade deliberately (shed in this order)
recommendations and search suggestions -> personalised content -> seat-map refresh rate -> new sign-ups -> new holds (waiting room) -> **never** confirms, payments, webhooks, refunds. Each step is a flag you can flip, tested before launch.

## Realtime
WebSocket/SSE fan-out for seat colour changes only; coalesce updates (send at most every 500 ms per show); on reconnect or tab focus, refetch the whole map. Fan-out cost grows with viewers x updates: for 100k viewers prefer polling a cached endpoint every 2-3 s.

## Cost
Spikes cost money (functions, egress, DB tier). Set budgets and alarms; scale the DB up for the event window and down after, with a rehearsed procedure.

## Launch checklist
Peak estimated (claimants, claims/s) · claim p95 measured · load test at 1.5x with invariants clean · waiting room on · rate limits on · caches warmed · kill switch rehearsed · deploy freeze set · on-call named · support briefed with the "payment succeeded but no ticket" script · reconciliation job scheduled · status page ready.
