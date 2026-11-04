# K6 Event bus and jobs

Make every side effect reliable: events committed with the change, delivered at least once, handled exactly once in effect, jobs fair across tenants.

- **Wave:** 2
- **Package:** `k6-events`
- **Needs:** K1
- **Tasks:** 11

Status: tick a task when its done-when and tests pass and the definition of done in [README](README.md) holds. Scope and acceptance live in [the PRD](../../prd/01-prd.md); the execution rules are in [the playbook](../README.md).

## Contract

- **Data:** outbox_event, processed_event, job, schedule, dead_letter
- **Offers:** EventBus (implements core EventPublisher), Subscribe, JobQueue, Scheduler, BrokerAdapter
- **Uses:** TenantContext, QuotaProvider
- **Events:** job.failed, job.dead_lettered, schedule.missed
- **Extension points:** Broker adapters; retry policies per subscriber; job handlers registered by modules

## Features delivered

- **F-14** Event envelope and transactional outbox (Must, 3 acceptance criteria)
- **F-15** Dispatch, subscriptions, retries and dead letters (Must, 4 acceptance criteria)
- **F-16** Job queue and tenant fairness (Must, 3 acceptance criteria)
- **F-17** Tenant-aware scheduler (Must, 3 acceptance criteria)
- **F-18** Event operations and chaos tests (Must, 3 acceptance criteria)

### Capabilities

- [MVP] Event envelope: id, type, version, tenant, actor, time, correlation and causation ids, payload
- [MVP] Transactional outbox: event row written in the same transaction as the state change
- [MVP] Dispatcher with ordering per entity and safe multi-worker claiming
- [MVP] Subscriptions declared in manifests; idempotent consumers
- [MVP] Retries with backoff and jitter; dead-letter queue; inspect and replay
- [MVP] Job queue with tenant context, priority, delay, timeout, cancel
- [MVP] Per-tenant fairness and concurrency caps
- [MVP] Scheduler: cron and one-off, tenant-aware, tenant timezone, single-fire, missed-run policy
- [MVP] Broker port with a database-backed default adapter
- [MVP] Event schema registry with compatibility check in CI
- [MVP] Metrics and alerts: lag, depth, retries, DLQ size
- [v2] External broker adapter

### Failure modes and guards

- **Event lost or emitted for a rolled-back change:** Outbox in the same transaction; kill test
- **Duplicate delivery repeats an effect:** Processed-event table per consumer; idempotent handlers
- **Poison message blocks a queue:** Max attempts then dead-letter; replay tool
- **One tenant floods the workers:** Per-tenant caps and fair claiming
- **Event schema change breaks consumers:** Registry rejects remove or rename; consumers ignore unknown fields
- **Long transaction stalls the dispatcher:** Claim by id ranges and age alerts on lag
- **Clock skew fires jobs early or twice:** Database time is authoritative; locks for single fire

## Security baseline for this module

Applies to every task below, on top of [the security guidelines](../../guidelines/security-guidelines.md).

- Events and jobs always carry a tenant; the worker restores context before running and fails closed without it.
- Payloads exclude classified data unless the event type declares it; large or sensitive data is passed by reference.
- Handlers are idempotent; poison messages cannot block a queue; replay requires a permission and is audited.

## Tasks

- [ ] **K6-T01** (T-081) Event envelope and type registry; compatibility check (M)
  - Feature: F-14 | Milestone: M-03 | Level: 4 | Lane: k6-events
  - Needs: K0-T07 (T-007), K0-T14 (T-014)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency
  - Security: S2. Module security baseline applies.
  - Done when: Registry loads from manifests; removing or renaming a field fails CI
  - Tests: compat-check fixtures
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K6-T02** (T-082) Outbox write API implementing core EventPublisher in the current transaction (S)
  - Feature: F-14 | Milestone: M-03 | Level: 5 | Lane: k6-events
  - Needs: K6-T01 (T-081), K1-T03 (T-017)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency
  - Security: S3. Threat: events without tenant or with sensitive payloads. Control: envelope requires tenant; payload schema marks classified fields; publish inside the transaction only.
  - Done when: Rollback discards the event; commit keeps it
  - Tests: transaction tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K6-T03** (T-083) Dispatcher: ordered per entity, safe multi-worker claiming, at-least-once relay (M)
  - Feature: F-15 | Milestone: M-03 | Level: 6 | Lane: k6-events
  - Needs: K6-T02 (T-082)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency
  - Security: S2. Module security baseline applies.
  - Done when: Two workers never claim the same row; a killed worker loses nothing
  - Tests: concurrency and kill tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K6-T04** (T-084) Subscription registry from manifests; idempotent consumers with a processed-event table (M)
  - Feature: F-15 | Milestone: M-03 | Level: 7 | Lane: k6-events
  - Needs: K6-T03 (T-083)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-high-concurrency
  - Security: S2. Module security baseline applies.
  - Done when: Duplicate delivery produces one effect
  - Tests: duplicate-delivery test
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K6-T05** (T-085) Retry with backoff and jitter; dead-letter queue; inspect and replay (M)
  - Feature: F-15 | Milestone: M-03 | Level: 8 | Lane: k6-events
  - Needs: K6-T04 (T-084)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency
  - Security: S2. Module security baseline applies.
  - Done when: A poison message dead-letters after the max attempts; replay works and is idempotent
  - Tests: poison and replay tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K6-T06** (T-086) Job queue: tenant context, priority, delay, timeout, cancel (M)
  - Feature: F-16 | Milestone: M-03 | Level: 4 | Lane: k6-events
  - Needs: K1-T02 (T-016), K0-T14 (T-014)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency
  - Security: S2. Module security baseline applies.
  - Done when: Job runs with the right tenant; timeout stops it; cancel works
  - Tests: integration tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K6-T07** (T-087) Per-tenant fairness and concurrency caps (M)
  - Feature: F-16 | Milestone: M-03 | Level: 5 | Lane: k6-events
  - Needs: K6-T06 (T-086), K1-T10 (T-024)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency
  - Security: S2. Module security baseline applies.
  - Done when: A flooding tenant does not delay others beyond the bound
  - Tests: fairness load test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K6-T08** (T-088) Scheduler: cron and one-off; tenant timezone; single fire; missed-run policy (M)
  - Feature: F-17 | Milestone: M-03 | Level: 5 | Lane: k6-events
  - Needs: K6-T06 (T-086)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency
  - Security: S2. Module security baseline applies.
  - Done when: A schedule fires once across multiple workers; missed runs follow policy
  - Tests: multi-worker and DST tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K6-T09** (T-089) Broker port, database-backed default adapter, contract tests (S)
  - Feature: F-15 | Milestone: M-03 | Level: 7 | Lane: k6-events
  - Needs: K6-T03 (T-083), K6-T06 (T-086)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency
  - Security: S2. Module security baseline applies.
  - Done when: Default adapter and an in-memory adapter both pass the contract suite
  - Tests: contract suite
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K6-T10** (T-090) Metrics and alerts: lag, depth, retries, DLQ size, job duration (S)
  - Feature: F-18 | Milestone: M-03 | Level: 9 | Lane: k6-events
  - Needs: K6-T05 (T-085), K0-T13 (T-013)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency, gx-ops-readiness
  - Security: S2. Module security baseline applies.
  - Done when: Dashboards show the metrics; a synthetic lag fires the alert
  - Tests: alert-fire test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K6-T11** (T-091) Chaos and soak tests: kill mid-dispatch, duplicates, skew, poison, failover (M)
  - Feature: F-18 | Milestone: M-03 | Level: 9 | Lane: k6-events
  - Needs: K6-T05 (T-085), K6-T08 (T-088)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency, gx-ops-readiness
  - Security: S2. Module security baseline applies.
  - Done when: All scenarios pass in the nightly job
  - Tests: nightly suite
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
