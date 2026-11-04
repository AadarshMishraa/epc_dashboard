---
name: gx-test-feature
description: Test a newly added or changed function, endpoint, screen or feature from every angle - happy path, boundaries, invalid input, permissions and tenant isolation, concurrency and idempotency, failure injection, data and migrations, UI states and accessibility, old-client compatibility, performance, security - then prove the tests can fail. Use after every function, endpoint, component or migration is added or changed, before marking a task done, and whenever the Stop hook reports code edited without tests.
---

# Test the feature from every direction

A test that has never failed proves nothing. Procedure: find what changed → pick the angles that
apply → write tests in the project's own framework → run → break the code on purpose to prove
the tests catch it → report coverage and gaps. Stack recipes: `references/recipes.md`.

## 1. Identify the unit under test
`git diff --stat` and `git diff` (or the plan task). List every new/changed: function, endpoint, edge
function, SQL function/policy/migration, component, job. Run `python3 .claude/gx/bin/codemap.py impact <file>`
for each and note callers and tables affected, since those need regression tests too.

## 2. Choose angles (mark N/A with a reason; never skip silently)
| # | Angle | Ask | Applies to |
|---|---|---|---|
| 1 | Happy path | Does it do the intended thing with typical input? | all |
| 2 | Boundaries | 0, 1, max, max+1, empty, null, very long, unicode, negative, decimals, dates (month end, 31 Mar/1 Apr, leap day, timezone) | all with input |
| 3 | Invalid input | Wrong type/shape/enum, missing fields, extra fields, malformed JSON, old-client payload | endpoints, forms, imports |
| 4 | State | Wrong-state action (approve twice, cancel completed), stale version, deleted parent | stateful entities |
| 5 | Permission | Each role allowed/denied; unauthenticated; expired session; field-level (cost/margin hidden) | all server code |
| 6 | Tenant isolation | Tenant B can't read/write tenant A's data via any id, filter, export, realtime channel | any tenant table/endpoint |
| 7 | Idempotency | Same request twice → one effect | mutating endpoints, webhooks, jobs |
| 8 | Concurrency | Two at once on the same row/slot/balance → one wins, invariant holds | balances, bookings, counters, queues |
| 9 | Failure injection | Dependency down/slow/garbage; DB error mid-way; partial failure → state consistent, error visible, retry safe | anything with I/O |
| 10 | Data & migration | Migration applies on a copy with real-shaped data; rollback; constraints reject bad rows; backfill idempotent | schema changes |
| 11 | UI states | Loading, empty, error, partial, success, no-permission, offline; long text; 360px and 1280px | components, screens |
| 12 | Accessibility | Keyboard-only, focus order, labels, contrast script, axe scan | components, screens |
| 13 | Compatibility | Old mobile/app version, old API consumers, feature flag off | API/contract changes |
| 14 | Performance | Query count (no N+1), `explain` uses index, 10k rows, payload size, p95 budget | list endpoints, reports, hot paths |
| 15 | Security | Injection strings, mass assignment, IDOR, oversized body, rate limit, secrets/PII not in logs or responses | anything exposed |
| 16 | Observability | Failure produces a log/error event with context; no secrets in it; audit row written | important actions |
| 17 | Regression | Existing callers and neighbouring tests still pass | all |

Minimums: every mutating endpoint gets 1–9 and 15–17; every table change gets 5, 6, 10 (+8 for
balances); every screen gets 11, 12 and the five-second/squint checks from `gx-cognitive-ux`.

## 3. Write the tests
- Use the project's existing framework and folder conventions; don't introduce a new one without a reason.
- Name tests by behaviour: `rejects approval when job already approved`. One assertion theme per test.
- Test through the public interface (endpoint/function/UI), asserting on observable outcomes (response, DB rows, emitted events), not on internals.
- Deterministic: freeze time, seed randomness, isolate DB state per test, no network to real providers.
- Concurrency tests run N parallel calls (e.g. 20) and assert the invariant, not the order.
- Bug found → add the failing test first, then fix.

## 4. Run
Run the new tests, then the surrounding suite for touched modules, then lint/type check. Record the
exact commands and results. Flaky = broken: fix or quarantine with a ticket, never retry-until-green.

## 5. Prove the tests can fail (mutation sanity check)
For each critical rule (permission check, tenant filter, idempotency guard, validation, constraint):
temporarily remove or invert it, rerun, and confirm a test goes red; restore it. Use `git stash`/`git
checkout -p` so nothing leaks into the commit. If nothing fails, the test is decoration: rewrite it.
Where a mutation tool exists (Stryker, mutmut) run it on the changed files.

## 6. Report
```
Unit(s) tested: …
Angles: 1✓ 2✓ 3✓ 4✓ 5✓ 6✓ 7✓ 8 N/A(no shared row) 9✓ …
Tests added: N (files) · Commands run → result
Mutation check: <rule removed> → <test that failed> (per critical rule)
Not covered / needs manual: <e.g. screen reader, real provider sandbox, load test> and why
Bugs found: <list, fixed or filed>
```
Update `.claude/memory/LEARNINGS.md` with any trap found. A feature is not done until its report exists in the PR.
