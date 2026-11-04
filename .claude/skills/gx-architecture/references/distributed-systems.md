# Distributed-systems behaviour (applies even to "simple" apps)

Every app with a client, a server, a database and a third party is a distributed system. These are
the failure modes that cause real incidents.

## Idempotency
- Every mutating endpoint that a client might retry (payments, bookings, stage changes, imports,
  webhooks) accepts an `Idempotency-Key` (client-generated UUID) and stores `(tenant, key) → result`
  with a unique constraint. A replay returns the stored result, never a second effect.
- Natural idempotency where possible: upsert by business key, `status` transitions guarded by
  `WHERE status = 'expected_previous'`.

## Concurrency
- Optimistic concurrency: a `version` integer (or `updated_at`) on mutable rows; updates include
  `WHERE id = $1 AND version = $2`; zero rows updated → conflict → tell the user, reload.
- Pessimistic locking (`SELECT … FOR UPDATE`) inside a short transaction for balance-like invariants.
- Enforce invariants in the database: unique constraints, check constraints, exclusion constraints
  (e.g. no overlapping bookings), foreign keys. Application checks alone race.

## Retries and timeouts
- Every outbound call has a timeout (connect + total). No timeout = a hung worker.
- Retry only idempotent operations, with exponential backoff + jitter, a max attempt count, and
  only on retryable errors (timeouts, 429, 5xx), never on 4xx validation errors.
- Circuit-break a failing provider: stop calling for a cooldown, degrade gracefully, alert.

## Queues and background jobs
- Jobs are idempotent and safe to run twice (at-least-once delivery is the norm).
- Dead-letter queue after N failures, with an alert and a way to replay.
- Record job state (queued/running/failed/done, attempts, last error) where support can see it.
- Long jobs report progress and can resume from a checkpoint.

## Transactional outbox
When a DB change must trigger an external effect (email, webhook, sync), write the change and an
`outbox` row in the same transaction; a worker sends outbox rows and marks them sent. Never "commit,
then call the API" in the request: if the call fails, state and the world disagree.

## Webhooks (incoming)
Verify signature on the raw body · reject stale timestamps (replay) · respond 2xx fast, process async ·
dedupe by provider event id · handle out-of-order delivery (compare versions/timestamps) · reconcile
daily against the provider's API for money events.

## Consistency for users
- Read-your-own-writes: after a mutation, the UI shows the new state (optimistic update or refetch).
- Realtime subscriptions can miss events on reconnect: refetch the current state on reconnect.
- Caches have explicit TTLs and invalidation on write; show freshness when it matters.

## Time
Store UTC (`timestamptz`), display in the user's zone (default `Asia/Kolkata` for India). Dates
without time (due dates, financial year) are `date`, not midnight timestamps. Indian financial year is
April–March. Use the DB clock for ordering, not client clocks. Scheduled jobs define their zone.

## Money
Integer minor units (paise) or `numeric(14,2)`; never floats. Store currency. Round once, at a
defined step, with a defined rule. Keep tax components separate. Ledger-style append-only entries
for balances; balances are derived and reconciled.

## Files
Upload direct to storage via signed URLs; validate type and size server-side; scan if user-supplied
and shared; private by default; generate thumbnails async; keep metadata (owner, tenant, purpose) in DB.
