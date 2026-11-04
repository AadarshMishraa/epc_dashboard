# E8 Site app and handover

Offline-safe site app, daily work, crew calendar, quality and punch list, commissioning and handover.

- **Lane:** `packs/epc/epc-field`
- **Tasks:** 7
- **Foundation waves needed:** 1, 2, 4, 5

Tick a task when its done-when and tests pass and the definition of done in [the playbook](README.md) holds. Scope and acceptance criteria live in [the pack PRD](../prd/01-prd.md).

## Features delivered

- **F-49** Site app: installable, offline and conflict-safe (Should, 0 acceptance criteria)
- **F-50** Site daily plan, checklist, photos and blockers (Should, 0 acceptance criteria)
- **F-51** Crew and subcontractor calendar (Should, 0 acceptance criteria)
- **F-52** Quality checks and punch list (Should, 0 acceptance criteria)
- **F-53** Commissioning and handover pack (Should, 0 acceptance criteria)

## Security baseline for this module

Applies to every task below, on top of the repository [security guidelines](../../../../docs/guidelines/security-guidelines.md).

- Every pack table has a tenant, forced row-level security and a negative cross-tenant test; the app role is not the owner.
- Every new action is a declared permission with a negative test (caller without it is denied); the server decides, the interface only hides.
- Every new field has a data class; personal data is masked in logs and audit diffs and has an erase and export handler.
- Amounts are integer paise; issued invoice and receipt records are never edited, only corrected by linked records.
- Files, links and imports are untrusted input: type, size and content checks, signed short-lived access, no personal data in URLs.

## Tasks

- [ ] **E8-T01** (T-084) Offline storage decision (S)
  - Feature: F-49 | Milestone: M-07 | Pack wave: C | Level: 0 | Lane: epc-field
  - Needs: none
  - Foundation features used (public APIs only): F-30 (needs foundation wave 4)
  - Agents: build Aadarsh decides, then gx-implementer | tests gx-qa-engineer | review gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: personal data on a lost or shared phone. Control: ADR with minimal fields, encryption, wipe on sign-out and after 72 hours.
  - Done when: ADR for what the phone may keep offline, how it is encrypted and when it is wiped
  - Tests: human gate: Aadarsh accepts; threat model on lost phone
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
  - Human gate: Decide Q-05 (what the phone may keep offline). gx-planner drafts the ADR; Aadarsh accepts it before any other E8 task starts.
- [ ] **E8-T02** (T-085) Site app shell (M)
  - Feature: F-49 | Milestone: M-07 | Pack wave: C | Level: 1 | Lane: epc-field
  - Needs: E8-T01 (T-084)
  - Foundation features used (public APIs only): F-64 (needs foundation wave 1)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-ux-reviewer, gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: data left in the cache or storage. Control: shell-only cache, no personal data outside the ADR, wipe on sign-out, strict content security policy.
  - Done when: installable web app with the shell cached and no data in cache beyond the ADR; works under the content security policy
  - Tests: no personal data in storage outside the ADR; sign-out wipes; CSP test
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E8-T03** (T-086) Offline queue and conflicts (M)
  - Feature: F-49 | Milestone: M-07 | Pack wave: C | Level: 2 | Lane: epc-field
  - Needs: E8-T02 (T-085)
  - Foundation features used (public APIs only): F-30, F-31 (needs foundation wave 4)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency
  - Security: S3. Threat: silent overwrite or replay of a queued change. Control: idempotency keys, version checks, conflicts surfaced to the user.
  - Done when: queued and synced state on every item for 72 hours; conflicts surfaced, never overwritten; idempotent sync
  - Tests: airplane-mode test; forced conflict; replay of a queued item changes nothing
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E8-T04** (T-087) Daily plan, checklist, photos and blockers (M)
  - Feature: F-50 | Milestone: M-07 | Pack wave: D | Level: 18 | Lane: epc-field
  - Needs: E8-T03 (T-086), E5-T07 (T-069)
  - Foundation features used (public APIs only): F-58, F-64 (needs foundation wave 5)
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer, gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: today's jobs, check-in with location only at check-in, checklist, photos, installed quantities, blockers and material requests
  - Tests: location consent test; photo size cap; 3-tap blocker report
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E8-T05** (T-088) Crew and subcontractor calendar (M)
  - Feature: F-51 | Milestone: M-07 | Pack wave: C | Level: 18 | Lane: epc-field
  - Needs: E5-T07 (T-069)
  - Foundation features used (public APIs only): F-08 (needs foundation wave 1)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: crews by day with clash and unready-site warnings; subcontractor scope and completion approval
  - Tests: clash detection; unready-site warning
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E8-T06** (T-089) Quality checks and punch list (M)
  - Feature: F-52 | Milestone: M-07 | Pack wave: D | Level: 19 | Lane: epc-field
  - Needs: E8-T04 (T-087)
  - Foundation features used (public APIs only): F-19 (needs foundation wave 2)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: checks, rework tasks, closure with photo, serial scan at install
  - Tests: punch closure needs a photo; scan matches stock serial
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E8-T07** (T-090) Commissioning and handover pack (M)
  - Feature: F-53 | Milestone: M-07 | Pack wave: D | Level: 20 | Lane: epc-field
  - Needs: E8-T06 (T-089), E5-T03 (T-065), E0-T13 (T-013)
  - Foundation features used (public APIs only): F-57, F-59 (needs foundation wave 5)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S2. Module security baseline applies.
  - Done when: test records, as-built documents, acceptance and warranty start; pack built from current documents
  - Tests: warranty starts at acceptance; pack lists current versions only
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
