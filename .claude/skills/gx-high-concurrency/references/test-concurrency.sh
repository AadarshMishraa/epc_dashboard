#!/usr/bin/env bash
# Proves the hold/confirm/inventory patterns under real concurrency. Needs psql and a scratch database with patterns.sql loaded.
#   PGHOST=... PGPORT=... PGUSER=... PGDATABASE=gxt bash test-concurrency.sh [clients=50]
# Exit 0 only if every invariant held.
set -uo pipefail
N="${1:-50}"; fail=0
q() { psql -X -Atq -v ON_ERROR_STOP=1 -c "$1"; }
check() { if [ "$2" = "$3" ]; then echo "PASS  $1 (=$2)"; else echo "FAIL  $1: expected $3, got $2"; fail=1; fi; }

SHOW=$(q "insert into shows(name) values ('t') returning id")
q "insert into show_seats(show_id, seat_id) select '$SHOW', 'A'||g from generate_series(1,10) g" >/dev/null

# 1. N users race for ONE seat
export SHOW
wins=$(seq 1 "$N" | xargs -P "$N" -I{} sh -c 'psql -X -Atq -c "select hold_seats('"'"'$SHOW'"'"'::uuid, array['"'"'A1'"'"'], gen_random_uuid())" 2>/dev/null | grep -c "^1$"' | paste -sd+ | bc)
check "one winner for one seat among $N racers" "$wins" 1
check "seat has exactly one holder" "$(q "select count(*) from show_seats where show_id='$SHOW' and seat_id='A1' and status='held' and held_by is not null")" 1

# 2. Overlapping multi-seat requests in opposite order: no deadlock, no partial holds
wins2=$(seq 1 "$N" | xargs -P "$N" -I{} sh -c 'if [ $(( {} % 2 )) -eq 0 ]; then S="{A2,A3}"; else S="{A3,A2}"; fi; psql -X -Atq -c "select hold_seats('"'"'$SHOW'"'"'::uuid, '"'"'$S'"'"'::text[], gen_random_uuid())" 2>/dev/null | grep -c "^2$"' | paste -sd+ | bc)
check "one winner for a 2-seat set requested in both orders" "$wins2" 1
check "no partial hold (A2 and A3 held together)" "$(q "select count(distinct held_by) from show_seats where show_id='$SHOW' and seat_id in ('A2','A3') and status='held'")" 1
grep -qi deadlock "${PGLOG:-/dev/null}" 2>/dev/null && { echo "FAIL  deadlock reported in log"; fail=1; }

# 3. Counter inventory: 100 racers for 7 tickets
T=$(q "insert into ticket_tiers(remaining) values (7) returning id")
export T
sold=$(seq 1 100 | xargs -P 50 -I{} sh -c 'psql -X -Atq -c "update ticket_tiers set remaining = remaining - 1 where id='"'"'$T'"'"' and remaining >= 1 returning 1" 2>/dev/null | grep -c "^1$"' | paste -sd+ | bc)
check "sold exactly the stock (7) out of 100 attempts" "$sold" 7
check "stock never negative" "$(q "select remaining from ticket_tiers where id='$T'")" 0

# 4. Expired lease can be re-claimed; live lease cannot; strict confirm refuses an expired lease, late confirm accepts it
U1=$(q "select gen_random_uuid()"); U2=$(q "select gen_random_uuid()")
q "select hold_seats('$SHOW','{A5}',  '$U1', interval '1 second')" >/dev/null; sleep 1.2
check "expired lease is re-claimable by another user" "$(q "select hold_seats('$SHOW','{A5}','$U2')")" 1
q "select hold_seats('$SHOW','{A6}','$U1', interval '1 second')" >/dev/null; sleep 1.2
B=$(q "select gen_random_uuid()")
check "strict confirm refuses an expired lease" "$(psql -X -Atq -c "select confirm_seats('$SHOW','{A6}','$U1','$B')" 2>&1 | grep -c hold_lost)" 1
check "late confirm (money captured) accepts it when nobody took the seat" "$(q "select confirm_seats('$SHOW','{A6}','$U1','$B', true)")" 1
q "insert into bookings(id,tenant_id,user_id,show_id,amount_paise) values ('$B', gen_random_uuid(), '$U1', '$SHOW', 100)" >/dev/null 2>&1

# 5. State machine rejects illegal transitions, allows legal ones
BK=$(q "insert into bookings(tenant_id,user_id,show_id,amount_paise) values (gen_random_uuid(),'$U1','$SHOW',100) returning id")
check "illegal hold->confirmed blocked" "$(psql -X -Atq -c "update bookings set status='confirmed' where id='$BK'" 2>&1 | grep -c illegal_transition)" 1
q "update bookings set status='payment_pending' where id='$BK'" >/dev/null
check "guarded update: second payer of same booking loses" "$(q "with u as (update bookings set status='paid' where id='$BK' and status='payment_pending' returning 1) select count(*) from u")" 1
check "…and the repeat gets 0 rows" "$(q "with u as (update bookings set status='paid' where id='$BK' and status='payment_pending' returning 1) select count(*) from u")" 0

# 6. Appointment overlap is impossible
PR=$(q "select gen_random_uuid()")
ok=$(seq 1 20 | xargs -P 20 -I{} sh -c 'psql -X -Atq -c "insert into appointments(provider_id,patient_id,starts_at,ends_at) values ('"'"'$0'"'"', gen_random_uuid(), timestamptz '"'"'2030-01-01 10:00+00'"'"', timestamptz '"'"'2030-01-01 10:30+00'"'"') returning 1" 2>/dev/null | grep -c "^1$"' "$PR" | paste -sd+ | bc)
check "20 racers for one provider slot: one booking" "$ok" 1

# 7. Sweeper
q "select hold_seats('$SHOW','{A7}',gen_random_uuid(), interval '1 second')" >/dev/null; sleep 1.2
check "sweeper releases the expired hold" "$(q "select sweep_expired_holds()")" 1

[ "$fail" = 0 ] && echo "ALL INVARIANTS HELD" || echo "SOME CHECKS FAILED"
exit "$fail"
