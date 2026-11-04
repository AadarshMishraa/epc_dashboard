-- GX high-concurrency patterns for PostgreSQL 14+ (Supabase-compatible). Adapt names; keep the shapes.
-- Tested: see references/test-concurrency.sh (50 parallel clients, exactly one winner).
-- Rule: the database decides who gets the unit. Constraints and single atomic statements, never read-then-write.

create extension if not exists btree_gist;

-- ============================================================================
-- 1. Per-unit inventory with a hold lease (seats, slots, rooms, vehicles)
--    available -> held (TTL lease) -> booked.  Expiry is enforced by the QUERY (hold_expires_at),
--    the sweeper below is only cleanup.
-- ============================================================================
create table if not exists shows (id uuid primary key default gen_random_uuid(), name text not null);

create table if not exists show_seats (
  show_id         uuid        not null references shows(id),
  seat_id         text        not null,
  status          text        not null default 'available' check (status in ('available','held','booked','blocked')),
  held_by         uuid,
  hold_expires_at timestamptz,
  booking_id      uuid,
  version         int         not null default 0,
  primary key (show_id, seat_id),
  constraint held_has_owner   check ((status = 'held')   = (held_by is not null and hold_expires_at is not null)),
  constraint booked_has_ref   check ((status = 'booked') = (booking_id is not null))
);
create index if not exists show_seats_open_idx on show_seats (show_id, status);

-- Hold N units, all or none. Locks rows in a fixed order (seat_id) and skips locked rows, so two multi-seat
-- requests can never deadlock; if any row is locked by someone else the whole request fails fast.
create or replace function hold_seats(p_show uuid, p_seats text[], p_user uuid,
                                      p_ttl interval default interval '8 minutes', p_max_per_user int default 6)
returns int language plpgsql as $$
declare v_locked text[]; v_updated int; v_active int;
begin
  if p_seats is null or cardinality(p_seats) = 0 then raise exception 'no_seats' using errcode = 'P0001'; end if;
  if cardinality(p_seats) <> (select count(distinct x) from unnest(p_seats) x) then
    raise exception 'duplicate_seats' using errcode = 'P0001';
  end if;

  select count(*) into v_active from show_seats
   where show_id = p_show and held_by = p_user and status = 'held' and hold_expires_at > now();
  if v_active + cardinality(p_seats) > p_max_per_user then raise exception 'hold_limit_exceeded' using errcode = 'P0001'; end if;

  select array_agg(seat_id order by seat_id) into v_locked from (
    select seat_id from show_seats
     where show_id = p_show and seat_id = any(p_seats)
     order by seat_id for update skip locked) l;
  if coalesce(cardinality(v_locked), 0) <> cardinality(p_seats) then
    raise exception 'seats_unavailable' using errcode = 'P0001';       -- someone else is mid-operation on one of them
  end if;

  update show_seats
     set status = 'held', held_by = p_user, hold_expires_at = now() + p_ttl, version = version + 1
   where show_id = p_show and seat_id = any(v_locked)
     and (status = 'available' or (status = 'held' and hold_expires_at <= now()));   -- free, or an expired lease
  get diagnostics v_updated = row_count;
  if v_updated <> cardinality(p_seats) then raise exception 'seats_unavailable' using errcode = 'P0001'; end if;  -- rolls back
  return v_updated;
end $$;

-- Confirm after payment. Strict: the lease must still be ours and unexpired.
create or replace function confirm_seats(p_show uuid, p_seats text[], p_user uuid, p_booking uuid, p_late boolean default false)
returns int language plpgsql as $$
declare v_updated int;
begin
  update show_seats
     set status = 'booked', booking_id = p_booking, held_by = null, hold_expires_at = null, version = version + 1
   where show_id = p_show and seat_id = any(p_seats)
     and ( (status = 'held' and held_by = p_user and (hold_expires_at > now() or p_late))   -- p_late: money already captured,
           or (p_late and status = 'available') );                                           -- accept if nobody else took it
  get diagnostics v_updated = row_count;
  if v_updated <> cardinality(p_seats) then raise exception 'hold_lost' using errcode = 'P0001'; end if;  -- caller: auto-refund
  return v_updated;
end $$;

-- Release a user's own holds (cancel / timeout in UI).
create or replace function release_seats(p_show uuid, p_seats text[], p_user uuid) returns int language sql as $$
  with r as (update show_seats set status='available', held_by=null, hold_expires_at=null, version=version+1
              where show_id=p_show and seat_id=any(p_seats) and status='held' and held_by=p_user returning 1)
  select count(*)::int from r $$;

-- Sweeper (cron every minute). Cleanup only. Small batches, skip locked, so it never fights the hot path.
create or replace function sweep_expired_holds(p_batch int default 1000) returns int language sql as $$
  with c as (select show_id, seat_id from show_seats where status='held' and hold_expires_at <= now()
              order by hold_expires_at limit p_batch for update skip locked),
       r as (update show_seats s set status='available', held_by=null, hold_expires_at=null, version=version+1
              from c where s.show_id=c.show_id and s.seat_id=c.seat_id returning 1)
  select count(*)::int from r $$;

-- ============================================================================
-- 2. Counter inventory (general admission, stock, licences, coupons): one guarded atomic UPDATE
-- ============================================================================
create table if not exists ticket_tiers (id uuid primary key default gen_random_uuid(), remaining int not null check (remaining >= 0));
-- 1 row back = got it. 0 rows = sold out. The CHECK is the last line of defence.
--   update ticket_tiers set remaining = remaining - $qty where id = $tier and remaining >= $qty returning remaining;

create table if not exists coupons (id uuid primary key default gen_random_uuid(), max_uses int not null, used int not null default 0,
                                    expires_at timestamptz, check (used <= max_uses));
create table if not exists coupon_redemptions (coupon_id uuid references coupons(id), user_id uuid, primary key (coupon_id, user_id));  -- one per user
--   with ins as (insert into coupon_redemptions values ($c,$u) on conflict do nothing returning 1)
--   update coupons set used = used + 1 where id = $c and used < max_uses and (expires_at is null or expires_at > now())
--     and exists (select 1 from ins) returning used;       -- run both in one transaction; no row = rejected

-- ============================================================================
-- 3. Time slots / resources: make overlap impossible, not unlikely
-- ============================================================================
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(), provider_id uuid not null, patient_id uuid not null,
  starts_at timestamptz not null, ends_at timestamptz not null, status text not null default 'booked',
  check (ends_at > starts_at),
  constraint no_double_booking exclude using gist (provider_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
    where (status in ('held','booked'))
);

-- ============================================================================
-- 4. Idempotency keys (client retries, double taps, webhook replays)
-- ============================================================================
create table if not exists idempotency_keys (
  tenant_id uuid not null, key text not null, request_hash text not null,
  status text not null default 'in_progress' check (status in ('in_progress','done')),
  response jsonb, created_at timestamptz not null default now(), primary key (tenant_id, key));
-- Claim:   insert into idempotency_keys (tenant_id,key,request_hash) values ($t,$k,$h) on conflict do nothing returning 1;
--   row returned  -> you own it: do the work, then update ... set status='done', response=$r in the SAME transaction as the effect.
--   no row        -> select it: hash differs -> 422 (key reuse);  in_progress -> 409 + Retry-After;  done -> replay stored response.
-- Purge keys after 24-72 h.

create table if not exists provider_events (provider text not null, event_id text not null, received_at timestamptz not null default now(),
                                            payload jsonb not null, processed_at timestamptz, primary key (provider, event_id));
--   insert ... on conflict do nothing returning 1;  no row = duplicate delivery, acknowledge with 200 and stop.

-- ============================================================================
-- 5. State machine enforced in the database
-- ============================================================================
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, user_id uuid not null, show_id uuid not null,
  status text not null default 'hold', amount_paise bigint not null check (amount_paise >= 0),
  payment_ref text unique, version int not null default 0, created_at timestamptz not null default now());

create table if not exists booking_transitions (from_status text not null, to_status text not null, primary key (from_status, to_status));
insert into booking_transitions values
  ('hold','payment_pending'),('hold','expired'),
  ('payment_pending','paid'),('payment_pending','failed'),('payment_pending','expired'),
  ('expired','paid'),                       -- late payment: money arrived after the lease ended; then confirm or refund
  ('paid','confirmed'),('paid','refund_pending'),
  ('confirmed','cancelled'),('cancelled','refund_pending'),('refund_pending','refunded'),
  ('failed','expired')
on conflict do nothing;

create or replace function enforce_booking_transition() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status
     and not exists (select 1 from booking_transitions t where t.from_status = old.status and t.to_status = new.status) then
    raise exception 'illegal_transition % -> %', old.status, new.status using errcode = 'P0001';
  end if;
  new.version := old.version + 1;
  return new;
end $$;
drop trigger if exists booking_state_guard on bookings;
create trigger booking_state_guard before update on bookings for each row execute function enforce_booking_transition();
-- Application writes are always guarded:  update bookings set status='paid' where id=$1 and status='payment_pending';  (0 rows = lost the race)

-- ============================================================================
-- 6. Work queue / outbox claim (many workers, no double processing)
-- ============================================================================
create table if not exists outbox (id bigserial primary key, topic text not null, payload jsonb not null,
  status text not null default 'queued', attempts int not null default 0, run_at timestamptz not null default now(), last_error text);
--   with c as (select id from outbox where status='queued' and run_at <= now() order by id limit 50 for update skip locked)
--   update outbox o set status='running', attempts=attempts+1 from c where o.id=c.id returning o.*;
-- Send, then mark done; on failure set status='queued', run_at = now() + backoff; after N attempts -> 'dead' + alert.

-- ============================================================================
-- 7. Rare per-entity serialisation (when a row lock does not fit): transaction-scoped advisory lock
-- ============================================================================
--   select pg_advisory_xact_lock(hashtextextended('payout:' || $provider_id, 0));   -- released at commit/rollback
-- Use sparingly; prefer constraints and row locks. Never hold across a network call.

-- ============================================================================
-- 8. Optimistic concurrency for editable records
-- ============================================================================
--   update jobs set stage=$s, version=version+1 where id=$id and version=$expected returning version;   0 rows -> conflict, reload
