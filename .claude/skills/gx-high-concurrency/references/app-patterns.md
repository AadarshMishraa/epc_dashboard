# App-side patterns (SQL does the deciding; the app calls it and maps the result)

## Supabase / Postgres RPC (Next.js server action or Edge Function)
- Put the claim in a `SECURITY INVOKER` or carefully-scoped `SECURITY DEFINER` function (patterns.sql) and call `supabase.rpc('hold_seats', {...})`.
  Map `P0001` messages to user text: `seats_unavailable` -> "Someone just took that. Pick another." (HTTP 409), `hold_limit_exceeded` -> 422, `hold_lost` -> trigger auto-refund path.
- Never do `select` then `update` through the JS client for a contested unit; the two calls are two transactions.
- Edge Function: take `Idempotency-Key`, claim it in `idempotency_keys`, do the work, store the response, return it on replay.
- Realtime: broadcast seat changes for UI freshness only; on reconnect refetch the seat map. Never trust a client-side "available".
- RLS: customers can read the public seat view (id, status) but not `held_by`; claim functions run with checked `auth.uid()`.

## Django / DRF
```python
from django.db import transaction
with transaction.atomic():
    earning = PanditEarning.objects.select_for_update().get(pandit=p)   # lock inside atomic, or it does nothing
    if earning.remaining_balance < amount: raise InsufficientBalance
    earning.remaining_balance = F("remaining_balance") - amount
    earning.save(update_fields=["remaining_balance"])
```
- Claim a unit: `Slot.objects.filter(id=sid, status="available").update(status="held", held_by=u, hold_expires_at=now()+ttl)` returns the row count; 1 = won. Use `Q(status="available") | Q(status="held", hold_expires_at__lte=now())`.
- Many rows: `select_for_update(skip_locked=True).order_by("id")`. Queue claim: same with `[:50]`.
- Unique constraints go in `Meta.constraints` (`UniqueConstraint`, `ExclusionConstraint` from `django.contrib.postgres.constraints`); catch `IntegrityError` and translate it to 409.
- Webhooks: `get_or_create` on `(provider, event_id)`; `created=False` -> return 200 immediately.
- Celery/RQ tasks: idempotent, `acks_late`, dedupe key, retry with backoff + jitter, dead-letter after N.
- Tests: `@pytest.mark.django_db(transaction=True)` + `ThreadPoolExecutor(20)`; each thread must close its DB connection (`connection.close()`).

## Node / TypeScript (any ORM)
- Interactive transactions: keep them short; no `await fetch` inside. Retry on serialization failure (`40001`) and deadlock (`40P01`) a bounded number of times, with jitter.
- Race test: `const r = await Promise.allSettled(Array.from({length: 50}, () => claim(unit)))`; assert `fulfilled.length === 1`, then the invariant query.

## Idempotency key rules
Client generates a UUID per user intent (not per HTTP attempt) and keeps it until the result is known. Server scopes it by tenant, stores a hash of the request, rejects a reused key with a different body (422), returns the stored response on replay, and returns 409 + `Retry-After` while the first attempt is still running. Purge after 24-72 h.

## Error mapping
| Cause | HTTP | User sees |
|---|---|---|
| Unit taken / lease lost | 409 | "Just taken. Here are similar options." (never a generic error) |
| Rate limited | 429 + `Retry-After` | "Busy, retrying in 5 s" (auto-retry once) |
| Waiting room | 202 + position | "You're 1,240th in line" |
| Validation | 422 | field-level message |
| Contention bug / timeout | 500/503 | "Try again. You haven't been charged." and an alert |
