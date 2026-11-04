# E0 Pack core, roles, configuration, demo and privacy handlers

Money and tax library, working calendar, classification, roles and approval policies, configuration bundle, demo tenant, erase and export handlers.

- **Lane:** `packs/epc/epc-core`
- **Tasks:** 13
- **Foundation waves needed:** 0, 1, 2, 3, 4, 5

Tick a task when its done-when and tests pass and the definition of done in [the playbook](README.md) holds. Scope and acceptance criteria live in [the pack PRD](../prd/01-prd.md).

## Features delivered

- **F-01** Pack workspace, boundary and money library (Must, 5 acceptance criteria)
- **F-02** Data classification and inventory for pack records (Must, 3 acceptance criteria)
- **F-03** Roles, scopes and approval policies (Must, 4 acceptance criteria)
- **F-04** Company setup and configuration bundle (Must, 4 acceptance criteria)
- **F-05** Demo and training tenant (Must, 3 acceptance criteria)
- **F-06** Erase, export and retention handlers (Must, 4 acceptance criteria)
- **F-07** Document generation (Must, 4 acceptance criteria)

## Security baseline for this module

Applies to every task below, on top of the repository [security guidelines](../../../../docs/guidelines/security-guidelines.md).

- Every pack table has a tenant, forced row-level security and a negative cross-tenant test; the app role is not the owner.
- Every new action is a declared permission with a negative test (caller without it is denied); the server decides, the interface only hides.
- Every new field has a data class; personal data is masked in logs and audit diffs and has an erase and export handler.
- Amounts are integer paise; issued invoice and receipt records are never edited, only corrected by linked records.
- Files, links and imports are untrusted input: type, size and content checks, signed short-lived access, no personal data in URLs.

## Tasks

- [ ] **E0-T01** (T-001) Pack workspace, manifest and boundary checks (S)
  - Feature: F-01 | Milestone: M-01 | Pack wave: A | Level: 0 | Lane: epc-core
  - Needs: none
  - Foundation features used (public APIs only): F-04, F-06 (needs foundation wave 0)
  - Agents: build gx-implementer | tests gx-qa-engineer | review module gate
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: packs/epc builds, its manifest validates, the boundary lint and industry-word lint pass with 0 foundation edits, and the sandbox host lists the pack
  - Tests: negative: import from a foundation internal path fails lint; manifest with an undeclared permission fails
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E0-T02** (T-002) Money, quantity and tax library (M)
  - Feature: F-01 | Milestone: M-01 | Pack wave: A | Level: 1 | Lane: epc-core
  - Needs: E0-T01 (T-001)
  - Foundation features used (public APIs only): F-02, F-03 (needs foundation wave 0)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: integer paise, units with conversion, rounding rules, GST and HSN or SAC rates as dated data; used by every pack module
  - Tests: property: sum of lines equals total in 10,000 cases; no float; rate change by date
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E0-T03** (T-003) Working calendar and clock rules (S)
  - Feature: F-01 | Milestone: M-01 | Pack wave: A | Level: 1 | Lane: epc-core
  - Needs: E0-T01 (T-001)
  - Foundation features used (public APIs only): F-02, F-03 (needs foundation wave 0)
  - Agents: build gx-implementer | tests - | review module gate
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: working-day arithmetic with state holiday lists as data; age and limit calculations read the Clock port
  - Tests: frozen-clock tests across weekends and holidays; month and year ends
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E0-T04** (T-004) Data classification and inventory for pack entities (S)
  - Feature: F-02 | Milestone: M-01 | Pack wave: A | Level: 1 | Lane: epc-core
  - Needs: E0-T01 (T-001)
  - Foundation features used (public APIs only): F-04, F-19 (needs foundation wave 2)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: every pack field carries a class; docs/compliance/data-inventory.md matches the manifest; masking applies in logs and audit diffs
  - Tests: privacycheck clean; seeded phone, email and address masked in log and diff
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E0-T05** (T-005) Declare permissions, roles and approval policies (M)
  - Feature: F-03 | Milestone: M-02 | Pack wave: A | Level: 1 | Lane: epc-core
  - Needs: E0-T01 (T-001)
  - Foundation features used (public APIs only): F-04 (needs foundation wave 0)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: manifest lists every pack action as a permission, 8 default roles, scopes by project and branch, thresholds and separation-of-duty rules
  - Tests: negative test per action: caller without the permission is denied; unknown permission string rejected
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E0-T06** (T-006) Bind roles and approval policies to identity and workflow (M)
  - Feature: F-03 | Milestone: M-02 | Pack wave: C | Level: 2 | Lane: epc-core
  - Needs: E0-T05 (T-005), E0-T07 (T-007)
  - Foundation features used (public APIs only): F-34, F-35, F-49 (needs foundation wave 4)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: privilege escalation or cross-branch reads. Control: roles are data, deny by default, scopes applied in the data layer, property tests over random grants.
  - Done when: roles are seeded per company; attribute scopes filter in the data layer; creator and approver separation enforced above the threshold
  - Tests: negative: escalation sequences by property test; cross-branch read returns 0 rows; last-owner removal refused
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E0-T07** (T-007) Pack configuration bundle (M)
  - Feature: F-04 | Milestone: M-02 | Pack wave: B | Level: 1 | Lane: epc-core
  - Needs: E0-T01 (T-001)
  - Foundation features used (public APIs only): F-23, F-24, F-25, F-29 (needs foundation wave 3)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S2. Module security baseline applies.
  - Done when: one bundle holds labels in English, Hindi, Marathi and Gujarati, lookup lists, thresholds, project types, custom fields and stage templates; applying twice changes 0 records
  - Tests: idempotent apply; failed apply changes nothing; label fallback to English
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E0-T08** (T-008) Company setup and onboarding (M)
  - Feature: F-04 | Milestone: M-02 | Pack wave: B | Level: 2 | Lane: epc-core
  - Needs: E0-T07 (T-007)
  - Foundation features used (public APIs only): F-07, F-10, F-23 (needs foundation wave 3)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S2. Module security baseline applies.
  - Done when: branches, warehouses, GST details with GSTIN check, calendar and thresholds are set in one guided flow and written through the bundle
  - Tests: GSTIN check-character test; tenant matrix on new tables; audit of threshold change
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E0-T09** (T-009) Demo tenant seed (M)
  - Feature: F-05 | Milestone: M-01 | Pack wave: A | Level: 2 | Lane: epc-core
  - Needs: E0-T02 (T-002), E0-T03 (T-003)
  - Foundation features used (public APIs only): F-03 (needs foundation wave 0)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S1. Module security baseline applies.
  - Done when: deterministic seed of 25 projects, 10 suppliers, stock, utility stages and exceptions in 2 states; 0 real personal values
  - Tests: seed twice gives identical data; privacycheck finds no real patterns
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E0-T10** (T-010) Pitch demo of the owner views (M)
  - Feature: F-05 | Milestone: M-01 | Pack wave: A | Level: 3 | Lane: epc-core
  - Needs: E0-T09 (T-009)
  - Foundation features used (public APIs only): F-64, F-65, F-66 (needs foundation wave 1)
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer, gx-staff-reviewer
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: read-only owner home, utility ageing, cash blocked and margin views over the seed using design-system templates, in both themes
  - Tests: contrast and colour-budget gates; cold-viewer test with 5 viewers; keyboard operation
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E0-T11** (T-011) Erase and export handlers for pack data (M)
  - Feature: F-06 | Milestone: M-06 | Pack wave: D | Level: 2 | Lane: epc-core
  - Needs: E0-T04 (T-004)
  - Foundation features used (public APIs only): F-54 (needs foundation wave 5)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: incomplete erasure or over-erasure. Control: every module registers handlers; statutory records are kept with the reason; per-handler outcome is reported.
  - Done when: each pack module that holds personal data registers an eraser and an exporter; statutory records are kept with the reason recorded
  - Tests: seeded customer erased in all handlers; export checksum verifies; hold recorded for invoice and receipt records
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E0-T12** (T-012) Retention schedule and request drill (S)
  - Feature: F-06 | Milestone: M-06 | Pack wave: D | Level: 3 | Lane: epc-core
  - Needs: E0-T11 (T-011)
  - Foundation features used (public APIs only): F-52, F-53 (needs foundation wave 5)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: retention periods per data category are configuration; a 10-request drill completes inside the limit
  - Tests: retention job removes or anonymises at the boundary; drill of 10 of 10
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E0-T13** (T-013) Document generation (M)
  - Feature: F-07 | Milestone: M-05 | Pack wave: D | Level: 0 | Lane: epc-core
  - Needs: none
  - Foundation features used (public APIs only): F-57, F-58 (needs foundation wave 5)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: server-side PDF from templates with embedded fonts for English, Hindi, Marathi and Gujarati; stored privately with versions and 5-minute access links
  - Tests: glyph test in 3 scripts; foreign-company access refused; regenerate keeps the original
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
