# E7 Billing records and collections

Milestone plan, invoice records, receipts, ageing, blocked-by chain and collections.

- **Lane:** `packs/epc/epc-billing`
- **Tasks:** 6
- **Foundation waves needed:** 0, 1, 2

Tick a task when its done-when and tests pass and the definition of done in [the playbook](README.md) holds. Scope and acceptance criteria live in [the pack PRD](../prd/01-prd.md).

## Features delivered

- **F-46** Milestone billing plan and invoice records (Must, 4 acceptance criteria)
- **F-47** Receipts, ageing and the blocked-by chain (Must, 4 acceptance criteria)
- **F-48** Collections board and reminders (Should, 0 acceptance criteria)

## Security baseline for this module

Applies to every task below, on top of the repository [security guidelines](../../../../docs/guidelines/security-guidelines.md).

- Every pack table has a tenant, forced row-level security and a negative cross-tenant test; the app role is not the owner.
- Every new action is a declared permission with a negative test (caller without it is denied); the server decides, the interface only hides.
- Every new field has a data class; personal data is masked in logs and audit diffs and has an erase and export handler.
- Amounts are integer paise; issued invoice and receipt records are never edited, only corrected by linked records.
- Files, links and imports are untrusted input: type, size and content checks, signed short-lived access, no personal data in URLs.

## Tasks

- [ ] **E7-T01** (T-078) Milestone billing plan (S)
  - Feature: F-46 | Milestone: M-06 | Pack wave: A | Level: 7 | Lane: epc-billing
  - Needs: E1-T07 (T-020)
  - Foundation features used (public APIs only): F-19 (needs foundation wave 2)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: plan lines from baseline milestones with percentage and amount summing to the contract value
  - Tests: sums to the paise; edit audited
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E7-T02** (T-079) Invoice records (M)
  - Feature: F-46 | Milestone: M-06 | Pack wave: A | Level: 8 | Lane: epc-billing
  - Needs: E7-T01 (T-078), E0-T02 (T-002)
  - Foundation features used (public APIs only): F-19 (needs foundation wave 2)
  - Agents: build Aadarsh decides, then gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S2. Module security baseline applies.
  - Done when: invoices entered or imported with Tally reference and tax split; unchangeable; corrections as credit-note records
  - Tests: edit refused; parts sum to total; unbilled-milestone exception at 7 days
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
  - Human gate: Default now: record and sync (Q-03 lean). A chartered accountant confirms at refinement; issuing invoices would be a new Later feature.
- [ ] **E7-T03** (T-080) Receipts (M)
  - Feature: F-47 | Milestone: M-06 | Pack wave: A | Level: 9 | Lane: epc-billing
  - Needs: E7-T02 (T-079)
  - Foundation features used (public APIs only): F-19 (needs foundation wave 2)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: cash, cheque and bank transfer receipts with reference and proof; retention and disputed amounts kept apart
  - Tests: duplicate reference refused; part receipt gives balance 40,000
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E7-T04** (T-081) Receivables ageing and ledger (M)
  - Feature: F-47 | Milestone: M-06 | Pack wave: A | Level: 10 | Lane: epc-billing
  - Needs: E7-T03 (T-080)
  - Foundation features used (public APIs only): F-08 (needs foundation wave 1)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: ageing bands, customer and project ledger; subsidy kept apart from customer dues
  - Tests: retention and disputes excluded from overdue; band boundary tests
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E7-T05** (T-082) Blocked-by chain (S)
  - Feature: F-47 | Milestone: M-06 | Pack wave: C | Level: 11 | Lane: epc-billing
  - Needs: E7-T04 (T-081), E2-T08 (T-030)
  - Foundation features used (public APIs only): none (needs foundation wave 0)
  - Agents: build gx-implementer | tests - | review module gate
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: a late invoice shows the unbilled milestone, the pending commissioning and the open utility query with owners
  - Tests: 3-link chain case; missing link shown as unknown
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E7-T06** (T-083) Collections board and reminders (M)
  - Feature: F-48 | Milestone: M-07 | Pack wave: A | Level: 11 | Lane: epc-billing
  - Needs: E7-T04 (T-081), E9-T01 (T-091)
  - Foundation features used (public APIs only): F-16, F-17 (needs foundation wave 2)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: overdue by age, promise-to-pay, daily call list and reminders that can be paused per customer
  - Tests: pause honoured; one reminder per rule per day
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
