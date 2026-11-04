# K7 Audit and privacy

Prove who did what, and run consent, data requests, retention and erasure as first-class workflows.

- **Wave:** 2 (K7a audit log) and 5 (K7b privacy desk)
- **Package:** `k7a-audit and k7b-privacy`
- **Needs:** K7a: K1, K6. K7b: K4, K5, K6
- **Tasks:** 16

Status: tick a task when its done-when and tests pass and the definition of done in [README](README.md) holds. Scope and acceptance live in [the PRD](../../prd/01-prd.md); the execution rules are in [the playbook](../README.md).

## Contract

- **Data:** audit_event, audit_anchor, notice_version, consent, data_request, retention_policy, erasure_job, incident, legal_hold
- **Offers:** Audit (implements core AuditSink), Consent, DataRequests, Retention, EraserRegistry
- **Uses:** TenantContext, Authorizer, ClassificationLookup, EraserRegistry (core ports); Scheduler from K6; WorkflowEngine from K5 for K7b
- **Events:** consent.granted, consent.withdrawn, data_request.opened, data_request.due, erasure.scheduled, erasure.completed, incident.opened, audit.chain_broken
- **Extension points:** Eraser and exporter handlers registered by every module; retention policies per data class; notice templates

## Features delivered

- **F-19** Audit trail core (Must, 4 acceptance criteria)
- **F-20** Tamper-evident audit chain (Must, 3 acceptance criteria)
- **F-21** Sensitive-read logging and audit query (Must, 3 acceptance criteria)
- **F-22** Audit retention and archive (Should, 0 acceptance criteria)
- **F-51** Notices and consent (Must, 3 acceptance criteria)
- **F-52** Data-request desk (Must, 3 acceptance criteria)
- **F-53** Retention engine (Must, 3 acceptance criteria)
- **F-54** Erasure, export and tenant exit (Must, 3 acceptance criteria)
- **F-55** Incident log and breach clocks (Must, 3 acceptance criteria)
- **F-56** Data inventory report (Should, 0 acceptance criteria)

### Capabilities

- [MVP] K7a: append-only audit log written in the same transaction as the change
- [MVP] K7a: actors include users, service accounts, AI clients (user via client) and system
- [MVP] K7a: before and after diffs for configured entities, masked by data classification
- [MVP] K7a: critical actions fail closed if the audit write fails
- [MVP] K7a: partitioning, retention (default at least 1 year, configurable), legal hold, archive
- [v1] K7a: hash chain per tenant with a verifier job
- [v1] K7a: sensitive-read logging and an audit query and export API
- [MVP] K7b: versioned notices per purpose and language
- [MVP] K7b: consent records: grant, withdraw, check, evidence, history
- [MVP] K7b: data-request desk (access, correction, erasure, grievance, nominee) with SLA timers
- [v1] K7b: retention engine with advance-notice event and statutory-hold exceptions
- [v1] K7b: export and erase handler registry; tenant export and exit
- [v1] K7b: incident log with 6-hour and 72-hour breach clocks; data inventory report

### Failure modes and guards

- **Audit write fails and the action proceeds:** Critical actions fail closed; others queue and alert
- **PII ends up in audit diffs:** Masking by classification; test with seeded personal data
- **Erasure conflicts with statutory records:** Statutory tables are skipped with the reason recorded; everything else is anonymised
- **Audit table grows without bound:** Monthly partitions, archive to cold storage, retention job
- **Log is tampered with:** Hash chain and a verifier that raises audit.chain_broken
- **A data request is missed:** SLA timers, escalation, daily due report

## Security baseline for this module

Applies to every task below, on top of [the security guidelines](../../guidelines/security-guidelines.md).

- Audit rows are append-only and written in the same transaction; critical actions fail closed when the audit write fails.
- Diffs and exports mask classified values; exports neutralise formula injection.
- Consent, notices, requests and incidents keep evidence (who, what, when, version) and never overwrite history.
- Erasure and export handlers are registered by every module that stores personal data; statutory holds are recorded, not skipped silently.

## Tasks

- [ ] **K7-T01** (T-092) Audit event model and in-transaction record implementing core AuditSink (M)
  - Feature: F-19 | Milestone: M-03 | Level: 5 | Lane: k7a-audit
  - Needs: K1-T03 (T-017), K0-T14 (T-014)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: missing or forgeable audit. Control: append-only table, same transaction, no update or delete grants for the app role.
  - Done when: Audit row commits or rolls back with the change
  - Tests: transaction tests
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K7-T02** (T-093) Actor model: user, service account, AI client (user via client), system; correlation ids (S)
  - Feature: F-19 | Milestone: M-03 | Level: 6 | Lane: k7a-audit
  - Needs: K7-T01 (T-092)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: Every record names an actor type and a correlation id
  - Tests: unit tests
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K7-T03** (T-094) Change diffs for configured entities, masked by classification (M)
  - Feature: F-19 | Milestone: M-03 | Level: 6 | Lane: k7a-audit
  - Needs: K7-T01 (T-092)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: Before and after captured; classified fields masked
  - Tests: seeded-PII masking test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K7-T04** (T-095) Hash chain per tenant, verifier job, tamper detection (M)
  - Feature: F-20 | Milestone: M-03 | Level: 6 | Lane: k7a-audit
  - Needs: K7-T01 (T-092)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: undetected history rewrite. Control: per-tenant hash chain, daily verifier, alert on break, chain head stored outside the table.
  - Done when: A modified row is detected and raises audit.chain_broken
  - Tests: tamper test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K7-T05** (T-096) Critical-action policy: fail closed if the audit write fails; others queue and alert (S)
  - Feature: F-19 | Milestone: M-03 | Level: 6 | Lane: k7a-audit
  - Needs: K7-T01 (T-092)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: action succeeds without evidence. Control: critical-action list fails closed; others queue with alert; test by failing the sink.
  - Done when: A critical action rolls back when the audit write fails
  - Tests: fault-injection test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K7-T06** (T-097) Sensitive-read logging decorator for classified reads and file downloads (S)
  - Feature: F-21 | Milestone: M-03 | Level: 6 | Lane: k7a-audit
  - Needs: K7-T01 (T-092)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: silent bulk reads of personal data. Control: decorator logs classified reads and downloads with actor and purpose; volume anomaly signal.
  - Done when: Reads of classified data produce audit rows
  - Tests: unit tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K7-T07** (T-098) Audit query and export API with permission checks (M)
  - Feature: F-21 | Milestone: M-03 | Level: 6 | Lane: k7a-audit
  - Needs: K7-T01 (T-092), K0-T14 (T-014)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: audit data exposure and formula injection in exports. Control: audit.read permission, masked diffs, neutralised export cells, export itself audited.
  - Done when: Requires audit.read; exports are themselves logged; paginated
  - Tests: authorisation tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K7-T08** (T-099) Monthly partitioning, retention (default at least 1 year), legal hold, archive (M)
  - Feature: F-22 | Milestone: M-03 | Level: 6 | Lane: k7a-audit
  - Needs: K7-T01 (T-092), K6-T08 (T-088)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy, gx-ops-readiness
  - Security: S2. Module security baseline applies.
  - Done when: Old partitions archive; legal hold blocks deletion
  - Tests: retention tests
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K7-T09** (T-100) Notice registry: versioned notices per purpose and language (S)
  - Feature: F-51 | Milestone: M-07 | Level: 6 | Lane: k7b-privacy
  - Needs: K4-T01 (T-056)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: A consent always points to a notice version
  - Tests: unit tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K7-T10** (T-101) Consent model and API: grant, withdraw, check, evidence, history (M)
  - Feature: F-51 | Milestone: M-07 | Level: 7 | Lane: k7b-privacy
  - Needs: K7-T09 (T-100), K6-T02 (T-082)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: consent forged or backdated. Control: append-only consent events with notice version, language, actor and time; withdrawal is immediate.
  - Done when: check() reflects withdrawal immediately; history is complete
  - Tests: consent lifecycle tests
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K7-T11** (T-102) Data-request desk on the workflow engine: access, correction, erasure, grievance, nominee; SLA timers; tenant-admin routing (M)
  - Feature: F-52 | Milestone: M-07 | Level: 9 | Lane: k7b-privacy
  - Needs: K5-T02 (T-069), K5-T06 (T-073)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: Each request has an owner and a due date; overdue ones escalate
  - Tests: SLA tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K7-T12** (T-103) Retention engine: policy per data class, scheduled delete or anonymise, advance-notice event, legal hold (M)
  - Feature: F-53 | Milestone: M-07 | Level: 7 | Lane: k7b-privacy
  - Needs: K6-T08 (T-088), K4-T05 (T-060)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: An expired record is removed after the notice event; a hold prevents deletion
  - Tests: retention tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K7-T13** (T-104) Eraser and exporter orchestration over the core EraserRegistry, with statutory-hold exceptions (M)
  - Feature: F-54 | Milestone: M-07 | Level: 10 | Lane: k7b-privacy
  - Needs: K7-T11 (T-102)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: incomplete erasure or over-erasure. Control: every module registers handlers; orchestrator reports per-handler outcome; statutory holds recorded with reason.
  - Done when: Every module's handler runs; statutory tables are skipped with the reason recorded
  - Tests: erasure drill on a seeded subject
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K7-T14** (T-105) Tenant export and exit: full export, then deletion with a deletion record (M)
  - Feature: F-54 | Milestone: M-07 | Level: 11 | Lane: k7b-privacy
  - Needs: K7-T13 (T-104)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: export leaks or deletes the wrong tenant. Control: tenant-scoped, permission and step-up required, checksum, deletion record, two-person confirmation by policy.
  - Done when: A seeded tenant exports completely and deletes cleanly
  - Tests: export and delete drill
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K7-T15** (T-106) Incident log and breach clocks (6-hour and 72-hour) with checklist (S)
  - Feature: F-55 | Milestone: M-07 | Level: 9 | Lane: k7b-privacy
  - Needs: K5-T06 (T-073)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: An incident starts both timers and lists the notifications due
  - Tests: timer tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K7-T16** (T-107) Data inventory report generated from field classification tags (S)
  - Feature: F-56 | Milestone: M-07 | Level: 7 | Lane: k7b-privacy
  - Needs: K4-T05 (T-060)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: Report lists every classified field with purpose and retention
  - Tests: report test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
