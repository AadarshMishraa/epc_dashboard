# E5 Receiving, stock and readiness

Goods receipt, inspection, serials, stock ledger, reservations, availability and the readiness gate.

- **Lane:** `packs/epc/epc-stock`
- **Tasks:** 8
- **Foundation waves needed:** 1, 2, 4, 5

Tick a task when its done-when and tests pass and the definition of done in [the playbook](README.md) holds. Scope and acceptance criteria live in [the pack PRD](../prd/01-prd.md).

## Features delivered

- **F-37** Goods receipt, inspection and serials (Must, 4 acceptance criteria)
- **F-38** Stock ledger and reservations (Must, 4 acceptance criteria)
- **F-39** Material availability and shortage (Must, 3 acceptance criteria)
- **F-40** Readiness gate (Must, 4 acceptance criteria)
- **F-41** Transfers and issue to site (Should, 0 acceptance criteria)

## Security baseline for this module

Applies to every task below, on top of the repository [security guidelines](../../../../docs/guidelines/security-guidelines.md).

- Every pack table has a tenant, forced row-level security and a negative cross-tenant test; the app role is not the owner.
- Every new action is a declared permission with a negative test (caller without it is denied); the server decides, the interface only hides.
- Every new field has a data class; personal data is masked in logs and audit diffs and has an erase and export handler.
- Amounts are integer paise; issued invoice and receipt records are never edited, only corrected by linked records.
- Files, links and imports are untrusted input: type, size and content checks, signed short-lived access, no personal data in URLs.

## Tasks

- [ ] **E5-T01** (T-063) Goods receipt (M)
  - Feature: F-37 | Milestone: M-05 | Pack wave: A | Level: 13 | Lane: epc-stock
  - Needs: E4-T07 (T-055)
  - Foundation features used (public APIs only): F-14, F-19 (needs foundation wave 2)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: receive against order lines with partial, over and under delivery; over-delivery needs approval
  - Tests: 60 of 100 received; 105 against 100 flagged
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E5-T02** (T-064) Inspection and rejection (M)
  - Feature: F-37 | Milestone: M-05 | Pack wave: D | Level: 14 | Lane: epc-stock
  - Needs: E5-T01 (T-063)
  - Foundation features used (public APIs only): F-57, F-58 (needs foundation wave 5)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: accepted, rejected and quarantined units with photos; only accepted units count as stock
  - Tests: 58 accepted of 60; photo attached through signed access
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E5-T03** (T-065) Serial and batch capture (M)
  - Feature: F-37 | Milestone: M-05 | Pack wave: A | Level: 14 | Lane: epc-stock
  - Needs: E5-T01 (T-063)
  - Foundation features used (public APIs only): F-08 (needs foundation wave 1)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: serial numbers unique per company, linked to order lines, warranty start empty until commissioning
  - Tests: duplicate serial refused; 40 of 40 linked
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E5-T04** (T-066) Stock ledger (M)
  - Feature: F-38 | Milestone: M-05 | Pack wave: A | Level: 14 | Lane: epc-stock
  - Needs: E5-T01 (T-063)
  - Foundation features used (public APIs only): F-08, F-19 (needs foundation wave 2)
  - Agents: build Aadarsh decides, then gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S2. Module security baseline applies.
  - Done when: append-only movements by item, warehouse, site and status; balances derived
  - Tests: no update or delete grant; balance equals the sum of movements in 10,000 random cases
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
  - Human gate: Decide Q-04 (warehouse stock or direct to site) from interviews; the ledger supports both locations.
- [ ] **E5-T05** (T-067) Reservations (M)
  - Feature: F-38 | Milestone: M-05 | Pack wave: A | Level: 15 | Lane: epc-stock
  - Needs: E5-T04 (T-066)
  - Foundation features used (public APIs only): F-14 (needs foundation wave 2)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency
  - Security: S2. Module security baseline applies.
  - Done when: reserve to a project; refuse over-reservation; warn on double promises
  - Tests: concurrency: 1 of 2 simultaneous reservations wins over 1,000 runs
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E5-T06** (T-068) Material availability and shortage (M)
  - Feature: F-39 | Milestone: M-05 | Pack wave: A | Level: 16 | Lane: epc-stock
  - Needs: E5-T05 (T-067), E4-T09 (T-057)
  - Foundation features used (public APIs only): F-08 (needs foundation wave 1)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: per project and required-by date: stock, reserved, confirmed incoming and uncovered shortfall with 3 actions
  - Tests: unconfirmed orders not counted; the 40 / 10 / 20 case
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E5-T07** (T-069) Readiness gate (M)
  - Feature: F-40 | Milestone: M-05 | Pack wave: C | Level: 17 | Lane: epc-stock
  - Needs: E5-T06 (T-068), E2-T03 (T-025)
  - Foundation features used (public APIs only): F-49, F-16 (needs foundation wave 4)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: ready, conditional or blocked with reasons across 6 checks; override needs approver and reason
  - Tests: blocked with a missing line; change to blocked raises 1 exception
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E5-T08** (T-070) Transfers and issue to site (M)
  - Feature: F-41 | Milestone: M-07 | Pack wave: A | Level: 15 | Lane: epc-stock
  - Needs: E5-T04 (T-066)
  - Foundation features used (public APIs only): F-19 (needs foundation wave 2)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S2. Module security baseline applies.
  - Done when: move stock between locations, issue to a crew, record consumption and returns
  - Tests: in-transit state; negative stock refused
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
