# E6 Cost and margin

Budget, commitments and actuals, forecast margin and floor, supplier bills and field expenses.

- **Lane:** `packs/epc/epc-cost`
- **Tasks:** 7
- **Foundation waves needed:** 2, 3, 5

Tick a task when its done-when and tests pass and the definition of done in [the playbook](README.md) holds. Scope and acceptance criteria live in [the pack PRD](../prd/01-prd.md).

## Features delivered

- **F-42** Budget, commitments and actual cost (Must, 4 acceptance criteria)
- **F-43** Forecast margin and margin floor (Must, 4 acceptance criteria)
- **F-44** Supplier bills and duplicate guard (Should, 0 acceptance criteria)
- **F-45** Field expenses (Should, 0 acceptance criteria)

## Security baseline for this module

Applies to every task below, on top of the repository [security guidelines](../../../../docs/guidelines/security-guidelines.md).

- Every pack table has a tenant, forced row-level security and a negative cross-tenant test; the app role is not the owner.
- Every new action is a declared permission with a negative test (caller without it is denied); the server decides, the interface only hides.
- Every new field has a data class; personal data is masked in logs and audit diffs and has an erase and export handler.
- Amounts are integer paise; issued invoice and receipt records are never edited, only corrected by linked records.
- Files, links and imports are untrusted input: type, size and content checks, signed short-lived access, no personal data in URLs.

## Tasks

- [ ] **E6-T01** (T-071) Baseline budget (S)
  - Feature: F-42 | Milestone: M-06 | Pack wave: A | Level: 7 | Lane: epc-cost
  - Needs: E1-T07 (T-020)
  - Foundation features used (public APIs only): F-19 (needs foundation wave 2)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: budget by category per project from the baseline
  - Tests: totals match the baseline to the paise
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E6-T02** (T-072) Commitment, actual and payment ledger (M)
  - Feature: F-42 | Milestone: M-06 | Pack wave: A | Level: 13 | Lane: epc-cost
  - Needs: E6-T01 (T-071), E4-T07 (T-055)
  - Foundation features used (public APIs only): F-14, F-19 (needs foundation wave 2)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-high-concurrency
  - Security: S2. Module security baseline applies.
  - Done when: orders are commitments, bills and expenses are actual, payments settle liability; no rupee counted twice
  - Tests: property: 10,000 event sequences with 0 double counts
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E6-T03** (T-073) Forecast margin and drivers (M)
  - Feature: F-43 | Milestone: M-06 | Pack wave: A | Level: 14 | Lane: epc-cost
  - Needs: E6-T02 (T-072)
  - Foundation features used (public APIs only): F-19 (needs foundation wave 2)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: contract less forecast final cost with variance from baseline and named drivers
  - Tests: 500,000 case gives 50,000 and 10%; driver lines sum to the paise
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E6-T04** (T-074) Margin floor and variance rules (S)
  - Feature: F-43 | Milestone: M-06 | Pack wave: B | Level: 15 | Lane: epc-cost
  - Needs: E6-T03 (T-073), E3-T02 (T-033)
  - Foundation features used (public APIs only): F-23 (needs foundation wave 3)
  - Agents: build gx-implementer | tests - | review module gate
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: per-company floor and variance thresholds feed exception rules; forecast stored at commissioning
  - Tests: 12% floor with 9% forecast raises 1 exception
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E6-T05** (T-075) Supplier bills and dues (M)
  - Feature: F-44 | Milestone: M-07 | Pack wave: A | Level: 14 | Lane: epc-cost
  - Needs: E6-T02 (T-072)
  - Foundation features used (public APIs only): F-19 (needs foundation wave 2)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: bills, due dates, payment approval and outstanding by supplier
  - Tests: bill against order moves commitment to actual
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E6-T06** (T-076) Duplicate bill guard (S)
  - Feature: F-44 | Milestone: M-07 | Pack wave: A | Level: 15 | Lane: epc-cost
  - Needs: E6-T05 (T-075)
  - Foundation features used (public APIs only): F-14 (needs foundation wave 2)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: flags probable duplicates on supplier, number, date and amount
  - Tests: near-duplicate fixtures; threshold test
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E6-T07** (T-077) Field expenses (S)
  - Feature: F-45 | Milestone: M-07 | Pack wave: D | Level: 19 | Lane: epc-cost
  - Needs: E6-T02 (T-072), E8-T04 (T-087)
  - Foundation features used (public APIs only): F-58 (needs foundation wave 5)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: labour, transport, crane and other costs with receipt photo and approval
  - Tests: receipt required over a limit; approval via the queue
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
