// k6 load test for a contested-inventory flow. Adapt BASE, routes and payloads.
//   k6 run -e BASE=https://staging.example.com -e SHOW=<uuid> -e TOKEN=<test-user-jwt> loadtest.k6.js
// Run against STAGING with synthetic data and payments in test mode. Never against production without a rehearsed kill switch.
// After the run: execute references/invariants.sql. Any row = failure, whatever the latency says.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE = __ENV.BASE, SHOW = __ENV.SHOW, TOKEN = __ENV.TOKEN;
const HOT_SEATS = (__ENV.HOT_SEATS || 'A1,A2,A3,A4,A5,A6,A7,A8,A9,A10').split(',');   // small pool = real contention
const won = new Counter('claims_won'), taken = new Counter('claims_taken'), server_errors = new Counter('claims_5xx');
const claimMs = new Trend('claim_ms', true);

export const options = {
  scenarios: {
    browse: { executor: 'ramping-arrival-rate', startRate: 50, timeUnit: '1s', preAllocatedVUs: 200, maxVUs: 2000,
              stages: [{ target: 500, duration: '1m' }, { target: 2000, duration: '2m' }, { target: 0, duration: '30s' }], exec: 'browse' },
    claim:  { executor: 'ramping-arrival-rate', startRate: 20, timeUnit: '1s', preAllocatedVUs: 200, maxVUs: 2000,
              stages: [{ target: 200, duration: '1m' }, { target: 800, duration: '2m' }, { target: 0, duration: '30s' }], exec: 'claim' },
  },
  thresholds: {
    claim_ms: ['p(95)<800'],             // claim latency budget (tune to your SLO)
    claims_5xx: ['count==0'],            // contention must surface as 409, never as a server error
    'http_req_duration{kind:browse}': ['p(95)<400'],
  },
};

const headers = { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } };

export function browse() {
  const r = http.get(`${BASE}/api/shows/${SHOW}/seats`, { ...headers, tags: { kind: 'browse' } });
  check(r, { 'seat map 200': (x) => x.status === 200 });
}

export function claim() {
  const seat = HOT_SEATS[Math.floor(Math.random() * HOT_SEATS.length)];
  const key = `${__VU}-${__ITER}-${Date.now()}`;
  const r = http.post(`${BASE}/api/shows/${SHOW}/hold`, JSON.stringify({ seats: [seat] }),
                      { ...headers, headers: { ...headers.headers, 'Idempotency-Key': key }, tags: { kind: 'claim' } });
  claimMs.add(r.timings.duration);
  if (r.status === 200 || r.status === 201) won.add(1);
  else if (r.status === 409) taken.add(1);          // correct answer for the losers
  else if (r.status >= 500) server_errors.add(1);   // this is the bug class we are hunting
  check(r, { 'claim answered 200/409/429': (x) => [200, 201, 409, 429].includes(x.status) });
  sleep(Math.random());
}

// Sanity target: claims_won must not exceed the number of units available; verify with invariants.sql, not here.
