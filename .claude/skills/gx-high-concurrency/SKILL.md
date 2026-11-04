---
name: gx-high-concurrency
description: Design and review anything where many users compete for limited units at the same moment - bookings, appointment slots, seats, stock, coupons, queue positions, wallet balances, payouts, assignments - including holds with expiry, payments and webhooks, idempotency, state machines, roles acting on the same record, traffic spikes, load tests and kill switches. Use when a feature has "only one can win", "limited quantity", "first come first served", a payment step between reserve and confirm, or an expected launch spike.
---

# High concurrency: limited units, many users, many roles

One question drives everything: **when two requests want the same unit in the same millisecond, what makes exactly
one win?** The answer must be a database constraint or a single atomic statement. Never "read, check, then write".
Related: `gx-architecture` (idempotency, retries), `gx-database-design` (constraints, RLS), `gx-test-feature`
(angles 7-8), `gx-ops-readiness` (kill switches). Project skills with the same topic override this one
(BookYourPandit `concurrency-idempotency`, DrInCity `drincity-schema` idempotency rules).

SQL you can paste and the proof it works: `references/patterns.sql`, `references/test-concurrency.sh`,
`references/invariants.sql`. App-side code: `references/app-patterns.md`. Spike handling: `references/spikes-and-limits.md`.
Load test: `references/loadtest.k6.js`.

## 1. Classify the contention (30 seconds)
| Shape | Example | Mechanism (first choice) |
|---|---|---|
| Named unit | seat A12, room 4, pandit on 14 Nov 9am | row per unit + guarded `UPDATE ... WHERE status='available'` or unique constraint |
| Time range on a resource | doctor 10:00-10:30 | exclusion constraint (`tstzrange` + `&&`) |
| Counted pool | 500 tickets, 100 coupons, 20 licences | `UPDATE ... SET remaining = remaining - n WHERE remaining >= n` + `CHECK (remaining >= 0)` |
| Balance | wallet, payout, credit | row lock (`FOR UPDATE`) or ledger rows + derived balance; `CHECK (balance >= 0)` |
| Queue / assignment | next token, next job, rider assignment | `FOR UPDATE SKIP LOCKED`; token numbers from a sequence |
| One per person | one vote, one redemption | unique constraint on `(entity, user)` |
| Document edits | two admins edit one job | optimistic `version` column |
Name the invariant in one sentence ("a seat has at most one confirmed owner") and write it as a constraint or an invariant query before any code.

## 2. The lease (hold) pattern for anything with a payment or approval step
`available -> held (TTL, owner) -> booked`, plus back to `available` when the lease ends.
- Expiry is enforced **by the claiming query** (`hold_expires_at <= now()` counts as free). The sweeper is cleanup, never correctness.
- Use the DB clock (`now()`), never client or app-server clocks.
- All-or-none for multi-unit requests; lock in a fixed order and `SKIP LOCKED` or `NOWAIT` so two buyers never deadlock.
- Caps: units per hold, active holds per user, holds per IP/device per minute. Without caps one bot holds the venue.
- Show the countdown; on expiry release the UI state and say what happened. Extending a hold has a limit and is audited.
- Price, tax and fee are snapshotted onto the hold; later price changes never alter an in-flight checkout.

## 3. Payment between hold and confirm
1. Create the booking `hold -> payment_pending` with an idempotency key; create the provider order from the server with the same key.
2. **The webhook is the truth**, not the browser redirect. Verify signature on the raw body, dedupe by provider event id (`provider_events`), acknowledge fast, process async.
3. On `paid`: confirm the units strictly. If the lease expired: **late confirm** if nobody took the unit (money already captured), else **auto-refund** and tell the user. Both are tested paths, not footnotes.
4. A scheduled reconciliation compares provider captures with paid bookings; differences go to a review list.
5. State machine in the database (`booking_transitions` + trigger): `hold -> payment_pending -> paid -> confirmed`, with `expired`, `failed`, `cancelled`, `refund_pending -> refunded`. Writers use guarded updates (`WHERE status = 'expected'`); zero rows means lost the race.
6. External effects (SMS, email, WhatsApp, ticket PDF, calendar) go through an outbox written in the same transaction. Never "commit, then call the API".

## 4. Many roles, one record
- Permissions are per **action** (`hold`, `release_other`, `override_price`, `refund`, `cancel_show`), scoped to the tenant/venue, enforced on the server and by RLS. The role name is only a bundle of actions.
- Staff and customers act through the **same** claim function. A box-office sale competes with a customer hold; no side door that skips the lease.
- Sensitive actions (manual release, refund, price override, bulk cancel) require a reason, write an audit row, and need a second approver above a threshold.
- Support/admin edits use the `version` check, so an admin never silently overwrites a user's change.
- Field-level visibility by role (customer phone, revenue, payout data). A venue manager sees only their own shows.

## 5. Scale in this order (cheapest first)
1. Correct constraints and indexes on the hot path (`(show_id, status)`); short transactions; no network call inside a transaction.
2. Connection pooling (PgBouncer / Supabase pooler) sized for the database, not the web tier.
3. Reads from cache/CDN with a few seconds TTL (listings, seat map). Writes always hit the authoritative row.
4. Waiting room / admission control for launches; per-user and per-IP rate limits strictest on hold and pay.
5. Read replicas for non-booking reads; queue for slow work; partition by show/city/tenant so one unit's inventory lives in one place.
6. Only then separate databases or services. Bookings never span databases.
Details: `references/spikes-and-limits.md`.

## 6. Edge cases to ask about every time
Double tap · two tabs/devices · back button after pay · payment succeeded after expiry · webhook twice / late / never ·
refund of a refunded booking · show cancelled with N paid bookings (bulk, resumable, idempotent refunds) · price change
mid-checkout · coupon limit race · same user buying more than the cap via many accounts · staff and customer on the same
unit · clock skew · daylight saving (non-India users) · booking after cut-off · unit blocked after being held ·
partial failure after the provider call · retry storm after an outage · realtime event missed (refetch on reconnect) ·
the sweeper is down for an hour · the database fails over mid-transaction.

## 7. Prove it (mandatory, `gx-test-feature` angles 7, 8, 9)
- **DB-level race test** in CI: N parallel claims on one unit, assert exactly one winner and the invariant. `references/test-concurrency.sh` is the template (50 clients, 14 checks, includes deadlock and expiry cases).
- **App-level race test**: `Promise.all` / threads against the real endpoint (recipes in `gx-test-feature/references/recipes.md`).
- **Mutation check**: remove the guard and confirm the test goes red. (When the guard was removed from the template, 40 of 50 racers "won".)
- **Webhook tests**: duplicate, out-of-order, bad signature, late success after expiry.
- **Load test before launch** on the real flow with a hot-unit scenario (`references/loadtest.k6.js`), then run `references/invariants.sql`. Pass criteria: zero invariant rows, p95 of the claim under budget, no 5xx from contention (409/"taken" is a correct answer, 500 is not).
- **Production tripwires**: nightly invariants, alert on any double ownership (should be impossible), stuck `payment_pending`, refund backlog, sweeper lag, webhook lag.

## 8. Operate it
- Per-show/per-module kill switch (pause new holds, keep confirms and refunds working). Rehearse it.
- Launch runbook: expected peak, capacity checked, waiting room on, support briefed, rollback known (`gx-delivery-pipeline`: freeze deploys during the on-sale).
- Dashboards: claim success rate, hold-to-paid conversion, queue length, p95 claim latency, expired holds, payment failures, webhook lag, refund queue.
- Postmortem rule: every double-booking or double-charge adds a failing test and an invariant query first.

## 9. Do not
- Lock a whole show or table per booking. Hold a transaction open across a payment call.
- Use Redis or an in-memory lock as the only source of truth (restart, failover or split brain loses it). Redis may front-run (rate limits, queues), the database decides.
- Trust client price, unit status, role or "I paid". Rely on the sweeper for correctness. Use client clocks.
- Retry non-idempotent calls. Put microservices in front of a design problem; a well-indexed Postgres, a queue, a cache and a waiting room carry a very large load.

## 10. Report
```
Contention shape(s): … · Invariant(s): … (constraint | query)
Mechanism: … · Lease TTL / caps: … · Payment path: webhook-truth? late-confirm? auto-refund?
Roles and actions: … · Race tests: N parallel → 1 winner ✓ · Mutation check ✓ · Load test: … · Invariants after load: empty ✓
Kill switch: … · Not verified: …
```
