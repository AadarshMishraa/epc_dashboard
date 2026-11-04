-- Run after every load test, after every incident, and nightly in production. Any row returned is a bug (or lost money).
-- Adapt table names. Page someone if a "must be empty" query is not empty.

-- 1. Two bookings for one unit (must be empty)
select show_id, seat_id, count(*) from show_seats where status = 'booked' group by 1, 2 having count(*) > 1;

-- 2. Unit marked booked with no confirmed booking behind it, or the reverse (must be empty)
select s.show_id, s.seat_id from show_seats s left join bookings b on b.id = s.booking_id
 where s.status = 'booked' and (b.id is null or b.status not in ('confirmed','paid'));
select b.id from bookings b where b.status = 'confirmed'
   and not exists (select 1 from show_seats s where s.booking_id = b.id);

-- 3. Counter inventory never negative and never over-sold (must be empty)
select id from ticket_tiers where remaining < 0;
select c.id from coupons c where c.used > c.max_uses;

-- 4. Money: paid bookings without a payment reference; payment references used twice (must be empty)
select id from bookings where status in ('paid','confirmed') and payment_ref is null;
select payment_ref, count(*) from bookings where payment_ref is not null group by 1 having count(*) > 1;

-- 5. Stuck states (alert when older than the threshold)
select id, status, created_at from bookings where status in ('hold','payment_pending') and created_at < now() - interval '30 minutes';
select id from bookings where status = 'refund_pending' and created_at < now() - interval '24 hours';
select show_id, seat_id from show_seats where status = 'held' and hold_expires_at < now() - interval '10 minutes';   -- sweeper behind?

-- 6. Overlapping appointments (the exclusion constraint makes this empty; keep the check as a tripwire)
select a.id, b.id from appointments a join appointments b
  on a.provider_id = b.provider_id and a.id < b.id and a.status in ('held','booked') and b.status in ('held','booked')
 and tstzrange(a.starts_at, a.ends_at) && tstzrange(b.starts_at, b.ends_at);

-- 7. Reconcile with the payment provider (daily job): provider-captured amounts vs paid bookings in the same window.
--    Differences go to a "needs review" list; never auto-adjust money silently.
