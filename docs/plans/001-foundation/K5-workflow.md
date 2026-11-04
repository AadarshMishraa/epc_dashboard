# K5 Workflow engine

Run every business process (lead to project, invoice approval, data request) from definitions stored as data.

- **Wave:** 4
- **Package:** `k5-workflow`
- **Needs:** K4, K6
- **Tasks:** 13

Status: tick a task when its done-when and tests pass and the definition of done in [README](README.md) holds. Scope and acceptance live in [the PRD](../../prd/01-prd.md); the execution rules are in [the playbook](../README.md).

## Contract

- **Data:** wf_definition, wf_version, wf_state, wf_transition, wf_instance, wf_history, wf_timer, wf_approval
- **Offers:** Workflow (start, transition, can, explain), GuardRegistry, ActionRegistry, Approvals
- **Uses:** TenantContext, EventPublisher, AuditSink, Authorizer (core ports); Expr, Fields from K4; Scheduler from K6
- **Events:** workflow.started, workflow.transitioned, sla.due_soon, sla.breached, approval.requested, approval.decided, workflow.stuck
- **Extension points:** Named guards and actions from modules; workflow templates in packs; calendar providers

## Features delivered

- **F-46** Workflow definitions and instances (Must, 3 acceptance criteria)
- **F-47** Guards, stage requirements, actions and explanations (Must, 4 acceptance criteria)
- **F-48** SLA timers and stuck-instance sweeper (Must, 3 acceptance criteria)
- **F-49** Approvals (Must, 3 acceptance criteria)
- **F-50** Workflow tooling (Should, 0 acceptance criteria)

### Capabilities

- [MVP] Definitions as data: states, transitions, metadata; published versions are immutable
- [MVP] Instances attach to any entity reference; transition API with optimistic concurrency and full history
- [MVP] Guards: declarative (expr) plus named code guards registered by modules
- [MVP] Stage requirements: required fields and documents before a transition
- [MVP] Actions: emit event, set field, create task (port), with a loop guard
- [MVP] SLA timers: business calendars, pause and resume, breach events, escalation
- [MVP] Approvals: single and multi-step, any-of and all-of, delegation, expiry
- [v1] Hold and blocked overlay; reopen rules
- [v1] Definition validator and dry-run simulator
- [v1] Version migration of running instances with preview
- [v1] Read APIs: graph export, history timeline, why-blocked explanation
- [v1] Pack workflow templates through K4 bundles
- [v1] Stuck-instance sweeper with metrics and alerts

### Failure modes and guards

- **Two people transition at once:** Optimistic concurrency on instance version; loser gets a clear conflict
- **Definition edited while instances run:** Published versions are immutable; instances finish on their version unless migrated
- **Guard has side effects:** Guards are pure; the validator and tests enforce it
- **Automation loops forever:** Max depth per transaction chain and cycle detection
- **Instance stuck without anyone noticing:** Timer sweeper and alerts
- **Approver unavailable:** Delegation and expiry with escalation

## Security baseline for this module

Applies to every task below, on top of [the security guidelines](../../guidelines/security-guidelines.md).

- Transitions authorize the actor on every call; guards and actions run with the acting tenant context.
- Actions cannot escalate privileges; the loop guard bounds cascades.
- Workflow definitions are validated before publish; published versions are immutable.

## Tasks

- [ ] **K5-T01** (T-068) Workflow definitions and versions: states, transitions, immutable published versions (M)
  - Feature: F-46 | Milestone: M-06 | Level: 6 | Lane: k5-workflow
  - Needs: K1-T03 (T-017), K4-T01 (T-056)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S2. Module security baseline applies.
  - Done when: A published version cannot be edited; a new version is created instead
  - Tests: immutability tests
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K5-T02** (T-069) Instances and transition API: any entity reference, optimistic concurrency, history (M)
  - Feature: F-46 | Milestone: M-06 | Level: 7 | Lane: k5-workflow
  - Needs: K5-T01 (T-068), K6-T02 (T-082)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Two simultaneous transitions: one wins, one gets a conflict; history records actor and reason
  - Tests: concurrency tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K5-T03** (T-070) Guards: declarative (expr) and named code guards registered by modules (M)
  - Feature: F-47 | Milestone: M-06 | Level: 8 | Lane: k5-workflow
  - Needs: K5-T02 (T-069), K4-T08 (T-063)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: guard bypass and code injection. Control: declarative guards use the expression sandbox; named guards come only from registered module code.
  - Done when: A failing guard blocks the transition and says why
  - Tests: guard tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K5-T04** (T-071) Stage requirements: required fields and documents before a transition (S)
  - Feature: F-47 | Milestone: M-06 | Level: 9 | Lane: k5-workflow
  - Needs: K5-T03 (T-070), K4-T06 (T-061)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Missing fields or documents block the transition with a list
  - Tests: requirement tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K5-T05** (T-072) Actions registry: emit event, set field, create task (port); loop guard (M)
  - Feature: F-47 | Milestone: M-06 | Level: 8 | Lane: k5-workflow
  - Needs: K5-T02 (T-069)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: An action cycle stops at the max depth with an error
  - Tests: loop test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K5-T06** (T-073) SLA timers: business calendar, pause and resume, breach events, escalation (M)
  - Feature: F-48 | Milestone: M-06 | Level: 8 | Lane: k5-workflow
  - Needs: K5-T02 (T-069), K6-T08 (T-088)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Breach fires once at the right time, including across weekends and holidays
  - Tests: calendar and DST tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K5-T07** (T-074) Approvals: multi-step, any-of and all-of, delegation, expiry (M)
  - Feature: F-49 | Milestone: M-06 | Level: 9 | Lane: k5-workflow
  - Needs: K5-T03 (T-070), K0-T14 (T-014)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Approval requires the right people; delegation and expiry work
  - Tests: approval tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K5-T08** (T-075) Hold and blocked overlay; reopen rules (S)
  - Feature: F-46 | Milestone: M-06 | Level: 8 | Lane: k5-workflow
  - Needs: K5-T02 (T-069)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: A held instance rejects transitions until released
  - Tests: unit tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K5-T09** (T-076) Definition validator and dry-run simulator (M)
  - Feature: F-50 | Milestone: M-06 | Level: 9 | Lane: k5-workflow
  - Needs: K5-T03 (T-070)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Dead ends and unreachable states are reported; a sample path simulates
  - Tests: validator tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K5-T10** (T-077) Version migration of running instances with preview (M)
  - Feature: F-50 | Milestone: M-06 | Level: 7 | Lane: k5-workflow
  - Needs: K5-T01 (T-068)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S2. Module security baseline applies.
  - Done when: Instances map to new states; preview shows the effect
  - Tests: migration tests
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K5-T11** (T-078) Read APIs: graph export, history timeline, why-blocked explanation (S)
  - Feature: F-47 | Milestone: M-06 | Level: 9 | Lane: k5-workflow
  - Needs: K5-T03 (T-070)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: UI can draw the graph and explain a block
  - Tests: API tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K5-T12** (T-079) Pack workflow templates through K4 bundles (S)
  - Feature: F-50 | Milestone: M-06 | Level: 8 | Lane: k5-workflow
  - Needs: K5-T01 (T-068), K4-T12 (T-067)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: A pack applies a workflow idempotently
  - Tests: bundle test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K5-T13** (T-080) Stuck-instance sweeper, metrics, alerts (S)
  - Feature: F-48 | Milestone: M-06 | Level: 9 | Lane: k5-workflow
  - Needs: K5-T06 (T-073), K6-T08 (T-088)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: An instance with a due timer and no progress raises workflow.stuck
  - Tests: sweeper test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
