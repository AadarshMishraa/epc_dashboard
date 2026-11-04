# E1 Import, customers, handoff and baseline

Bring sheets in safely; hold customers and sites; turn a won deal into a baselined project with templates.

- **Lane:** `packs/epc/epc-projects`
- **Tasks:** 9
- **Foundation waves needed:** 0, 1, 2, 3, 5

Tick a task when its done-when and tests pass and the definition of done in [the playbook](README.md) holds. Scope and acceptance criteria live in [the pack PRD](../prd/01-prd.md).

## Features delivered

- **F-08** Guided import from sheets (Must, 4 acceptance criteria)
- **F-09** Customer and site records (Must, 4 acceptance criteria)
- **F-10** Won-deal handoff and project baseline (Must, 4 acceptance criteria)
- **F-11** Project types and templates (Must, 3 acceptance criteria)

## Security baseline for this module

Applies to every task below, on top of the repository [security guidelines](../../../../docs/guidelines/security-guidelines.md).

- Every pack table has a tenant, forced row-level security and a negative cross-tenant test; the app role is not the owner.
- Every new action is a declared permission with a negative test (caller without it is denied); the server decides, the interface only hides.
- Every new field has a data class; personal data is masked in logs and audit diffs and has an erase and export handler.
- Amounts are integer paise; issued invoice and receipt records are never edited, only corrected by linked records.
- Files, links and imports are untrusted input: type, size and content checks, signed short-lived access, no personal data in URLs.

## Tasks

- [ ] **E1-T01** (T-014) Import engine: parse and validate (M)
  - Feature: F-08 | Milestone: M-02 | Pack wave: A | Level: 2 | Lane: epc-projects
  - Needs: E0-T02 (T-002)
  - Foundation features used (public APIs only): F-02 (needs foundation wave 0)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: malicious or malformed upload (macro, formula injection, zip bomb, oversize). Control: type sniffing, size and row caps, text-only cells, no macro execution, parse in a limited-memory worker.
  - Done when: CSV and XLSX parsed with size, row and type limits; macros rejected; cells starting with = + - @ stored as text
  - Tests: fuzz: malformed and oversized files; formula and macro cases; memory bound on 5,000 rows
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E1-T02** (T-015) Column mapper, dry run and row errors (M)
  - Feature: F-08 | Milestone: M-02 | Pack wave: A | Level: 3 | Lane: epc-projects
  - Needs: E1-T01 (T-014)
  - Foundation features used (public APIs only): F-65 (needs foundation wave 1)
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer, gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: mapping screen with saved mappings; dry run lists every row error with row and column and writes nothing
  - Tests: 3 bad rows reported exactly; nothing imported silently; 60-second limit on 5,000 rows
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E1-T03** (T-016) Import templates and idempotent re-import (S)
  - Feature: F-08 | Milestone: M-02 | Pack wave: A | Level: 4 | Lane: epc-projects
  - Needs: E1-T02 (T-015)
  - Foundation features used (public APIs only): F-14 (needs foundation wave 2)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: templates for projects, BOMs, suppliers, stock and customers with natural keys; a second import creates 0 duplicates
  - Tests: run twice gives 0 new records; changed rows update and audit
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E1-T04** (T-017) Customer and site records (M)
  - Feature: F-09 | Milestone: M-02 | Pack wave: A | Level: 2 | Lane: epc-projects
  - Needs: E0-T04 (T-004)
  - Foundation features used (public APIs only): F-08, F-19 (needs foundation wave 2)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: customer, site and contact tables with tenant isolation, notice version and consent state fields, classified fields
  - Tests: tenant matrix; masked in logs; consent state required or flagged
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E1-T05** (T-018) Duplicate detection and audited merge (M)
  - Feature: F-09 | Milestone: M-02 | Pack wave: A | Level: 3 | Lane: epc-projects
  - Needs: E1-T04 (T-017)
  - Foundation features used (public APIs only): F-19 (needs foundation wave 2)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: candidate pairs on phone, email and address; merge only on confirmation, history moves, merge audited
  - Tests: normalisation property tests; 0 silent merges; merge keeps both ids in the audit
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E1-T06** (T-019) Won-deal handoff (M)
  - Feature: F-10 | Milestone: M-02 | Pack wave: A | Level: 5 | Lane: epc-projects
  - Needs: E1-T03 (T-016), E1-T04 (T-017)
  - Foundation features used (public APIs only): F-14 (needs foundation wave 2)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: project created from an import row, a CRM export or manual entry; missing data listed
  - Tests: row without contract value flagged and not baselined; no retyped fields
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E1-T07** (T-020) Project baseline and revisions (M)
  - Feature: F-10 | Milestone: M-02 | Pack wave: A | Level: 6 | Lane: epc-projects
  - Needs: E1-T06 (T-019)
  - Foundation features used (public APIs only): F-19 (needs foundation wave 2)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: scope, contract value, budget by category and milestones frozen as revision 1; changes create revisions with reason
  - Tests: revision 1 unchanged after edit; planned margin to the paise; audit holds reason
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E1-T08** (T-021) Project types and templates (M)
  - Feature: F-11 | Milestone: M-02 | Pack wave: B | Level: 7 | Lane: epc-projects
  - Needs: E1-T07 (T-020), E0-T07 (T-007)
  - Foundation features used (public APIs only): F-23, F-29 (needs foundation wave 3)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S2. Module security baseline applies.
  - Done when: milestones, tasks, dependencies and required evidence for 3 project types, editable as data
  - Tests: edits apply to new projects only; dependency warning test
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E1-T09** (T-022) Consent and notice wiring (S)
  - Feature: F-09 | Milestone: M-02 | Pack wave: D | Level: 3 | Lane: epc-projects
  - Needs: E1-T04 (T-017)
  - Foundation features used (public APIs only): F-51 (needs foundation wave 5)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: consent given or withdrawn through the privacy desk updates the customer's state with notice version, language, actor and time; withdrawal stops optional messages
  - Tests: withdrawal blocks the next optional message; evidence is append-only
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
