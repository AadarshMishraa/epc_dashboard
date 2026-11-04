# E2 Utility and subsidy tracker

Stage templates, stage record and clock, document gates and evidence, escalation, cash blocked and compliance flags.

- **Lane:** `packs/epc/epc-utility`
- **Tasks:** 9
- **Foundation waves needed:** 2, 3, 4, 5

Tick a task when its done-when and tests pass and the definition of done in [the playbook](README.md) holds. Scope and acceptance criteria live in [the pack PRD](../prd/01-prd.md).

## Features delivered

- **F-12** Utility and scheme stage templates (Must, 4 acceptance criteria)
- **F-13** Stage record and clock (Must, 4 acceptance criteria)
- **F-14** Stage document gates and evidence log (Must, 4 acceptance criteria)
- **F-15** Escalation rules (Must, 4 acceptance criteria)
- **F-16** Cash-blocked value (Must, 4 acceptance criteria)
- **F-17** DCR and ALMM flags (Should, 0 acceptance criteria)

## Security baseline for this module

Applies to every task below, on top of the repository [security guidelines](../../../../docs/guidelines/security-guidelines.md).

- Every pack table has a tenant, forced row-level security and a negative cross-tenant test; the app role is not the owner.
- Every new action is a declared permission with a negative test (caller without it is denied); the server decides, the interface only hides.
- Every new field has a data class; personal data is masked in logs and audit diffs and has an erase and export handler.
- Amounts are integer paise; issued invoice and receipt records are never edited, only corrected by linked records.
- Files, links and imports are untrusted input: type, size and content checks, signed short-lived access, no personal data in URLs.

## Tasks

- [ ] **E2-T01** (T-023) Stage template model on the workflow engine (M)
  - Feature: F-12 | Milestone: M-03 | Pack wave: C | Level: 7 | Lane: epc-utility
  - Needs: E1-T07 (T-020), E0-T03 (T-003)
  - Foundation features used (public APIs only): F-46, F-47, F-48 (needs foundation wave 4)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: state, utility, scheme and project type map to a stage list with limits in working days, published and versioned
  - Tests: publish refused with a missing exit stage; edit leaves existing jobs unchanged; state B added by configuration only
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E2-T02** (T-024) Seed stage templates for the first two states (M)
  - Feature: F-12 | Milestone: M-03 | Pack wave: C | Level: 8 | Lane: epc-utility
  - Needs: E2-T01 (T-023)
  - Foundation features used (public APIs only): F-23, F-29 (needs foundation wave 3)
  - Agents: build Aadarsh decides, then gx-implementer | tests - | review gx-staff-reviewer
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S1. Module security baseline applies.
  - Done when: stage lists, limits and document checklists for the two chosen states and the PM Surya Ghar flow, verified with the design partner
  - Tests: review by the design partner recorded in the PR; 0 code change to add a state
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
  - Human gate: Decide Q-01 (first states and utilities). The design partner confirms the stage lists before merge.
- [ ] **E2-T03** (T-025) Stage record (M)
  - Feature: F-13 | Milestone: M-03 | Pack wave: C | Level: 8 | Lane: epc-utility
  - Needs: E2-T01 (T-023)
  - Foundation features used (public APIs only): F-46, F-49 (needs foundation wave 4)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S2. Module security baseline applies.
  - Done when: per job: current stage, owner, waiting-on party, date entered, next action, all required on a move
  - Tests: 4 required fields enforced; concurrent moves give 1 success and 1 conflict
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E2-T04** (T-026) Stage age and limit clock (S)
  - Feature: F-13 | Milestone: M-03 | Pack wave: C | Level: 9 | Lane: epc-utility
  - Needs: E2-T03 (T-025)
  - Foundation features used (public APIs only): F-48 (needs foundation wave 4)
  - Agents: build gx-implementer | tests - | review module gate
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: age in working days against the limit with bands; breach is an event
  - Tests: frozen-clock tests; holiday exclusion; limit change applies to new jobs only
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E2-T05** (T-027) Stage document gates (M)
  - Feature: F-14 | Milestone: M-03 | Pack wave: D | Level: 9 | Lane: epc-utility
  - Needs: E2-T03 (T-025)
  - Foundation features used (public APIs only): F-49, F-59 (needs foundation wave 5)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: required documents per stage block the move; override needs approver and reason; expiry flags at 30 days and on the day
  - Tests: missing document named; override by non-approver refused; expiry boundary test
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E2-T06** (T-028) Evidence log (M)
  - Feature: F-14 | Milestone: M-03 | Pack wave: D | Level: 9 | Lane: epc-utility
  - Needs: E2-T03 (T-025)
  - Foundation features used (public APIs only): F-57, F-58, F-19 (needs foundation wave 5)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: portal reference, screenshot, acknowledgement and call note entries that cannot be edited or deleted
  - Tests: append-only test; files only through signed access; masked personal data in notes
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E2-T07** (T-029) Escalation rules (M)
  - Feature: F-15 | Milestone: M-03 | Pack wave: C | Level: 10 | Lane: epc-utility
  - Needs: E2-T04 (T-026), E3-T14 (T-045)
  - Foundation features used (public APIs only): F-16, F-17, F-48 (needs foundation wave 4)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency
  - Security: S2. Module security baseline applies.
  - Done when: at breach a task goes to the project manager, later an exception to the owner; closes on completion
  - Tests: no duplicates on retry; job killed midway sends once; chaos test on the scheduler
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E2-T08** (T-030) Cash-blocked value (S)
  - Feature: F-16 | Milestone: M-03 | Pack wave: C | Level: 9 | Lane: epc-utility
  - Needs: E2-T03 (T-025), E1-T07 (T-020)
  - Foundation features used (public APIs only): F-19 (needs foundation wave 2)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: contract value of installed but not energised or unclaimed jobs, grouped by blocker; subsidy excluded from receivables
  - Tests: figure equals sum of contract values to the paise; refresh in 5 minutes or less
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E2-T09** (T-031) DCR and ALMM flags (M)
  - Feature: F-17 | Milestone: M-07 | Pack wave: B | Level: 15 | Lane: epc-utility
  - Needs: E4-T02 (T-050), E5-T03 (T-065)
  - Foundation features used (public APIs only): F-23 (needs foundation wave 3)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: flags on BOM lines and serials; warning before invoicing when data is missing
  - Tests: missing-data warning; rule change by data only
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
