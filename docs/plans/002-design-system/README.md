# UI Design system

Turn the reference design in design/ into a shipped, tested UI package with gates that keep it on brand and accessible.

- **Wave:** 0
- **Package:** `design`
- **Needs:** K0-T01 for bindings; K1-T09 and K7-T06 for two tasks
- **Tasks:** 14

Status: tick a task when its done-when and tests pass and the definition of done in [the design system](../../design/design-system.md) holds. Scope and acceptance live in [the PRD](../../prd/01-prd.md); the execution rules are in [the playbook](../README.md).

## Features delivered

- **F-62** Design tokens and themes (Must, 4 acceptance criteria)
- **F-63** Component library (Must, 4 acceptance criteria)
- **F-64** Application shell and page templates (Must, 3 acceptance criteria)
- **F-65** Data tables, charts and secure data display (Must, 4 acceptance criteria)
- **F-66** Design quality gates (Must, 4 acceptance criteria)
- **F-67** Tenant branding with contrast guard (Should, 0 acceptance criteria)

## Security baseline for this module

Applies to every task below, on top of [the security guidelines](../../guidelines/security-guidelines.md).

- No innerHTML, eval or inline handlers; render text as text; sanitize any rich text with an allow-list.
- No secrets or personal data in browser storage, URLs or the bundle; the interface never replaces server authorization.
- Components work under script-src 'self' and style-src 'self' with no inline style attributes.

## Tasks

- [ ] **UI-T01** (T-901) Publish tokens as the single source: tokens.css packaged, token lint bans raw hex and magic pixel values outside it (S)
  - Feature: F-62 | Milestone: M-08 | Level: 0 | Lane: design
  - Needs: none
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: design/tokens.css is consumed through one package entry; lint fails on raw hex in any component stylesheet
  - Tests: token lint fixtures; contrast audit on both themes
  - Rollback: Revert the commit; no data is affected. Gate checks stay on.
- [ ] **UI-T02** (T-902) Theme runtime: OS default, stored preference with safe fallback, no flash, profile persistence hook (S)
  - Feature: F-62 | Milestone: M-08 | Level: 1 | Lane: design
  - Needs: UI-T01 (T-901)
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: Dark OS with no preference loads dark with no flash; blocked storage does not throw; the preference is saved through a port once sign-in exists
  - Tests: unit tests with storage stubbed; no-flash check in browser test
  - Rollback: Revert the commit; no data is affected. Gate checks stay on.
- [ ] **UI-T03** (T-903) Front-end binding decision (ADR) and wrapper conventions that reuse the CSS classes (S)
  - Feature: F-63 | Milestone: M-08 | Level: 1 | Lane: design
  - Needs: K0-T01 (T-001), UI-T01 (T-901)
  - Agents: build Aadarsh decides, then gx-implementer | tests - | review gx-ux-reviewer
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: ADR accepted; wrappers map 1 to 1 to the documented classes and never fork the look
  - Tests: review only
  - Rollback: Revert the commit; no data is affected. Gate checks stay on.
  - Human gate: Decided in ADR-0006: React wrappers over the CSS classes. Record conventions in the package README; no new decision needed.
- [ ] **UI-T04** (T-904) Buttons and form controls: variants, sizes, busy and disabled states, field, error and hint patterns (M)
  - Feature: F-63 | Milestone: M-08 | Level: 2 | Lane: design
  - Needs: UI-T03 (T-903)
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer, gx-staff-reviewer
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: Every state in the reference page renders from the library; errors are announced through aria-describedby; one primary per view lint
  - Tests: component tests; axe; lint fixture with 2 primaries
  - Rollback: Revert the commit; no data is affected. Gate checks stay on.
- [ ] **UI-T05** (T-905) Menus: action menu, single select, searchable list, split button; keyboard, outside click, edge alignment (M)
  - Feature: F-63 | Milestone: M-08 | Level: 2 | Lane: design
  - Needs: UI-T03 (T-903)
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer, gx-staff-reviewer
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: Enter, arrows, Home, End, Escape and Tab behave per the spec; over 8 items adds search and scrolls at 320 px; right-edge menus stay inside the viewport
  - Tests: keyboard tests on 6 keys; axe; visual test at 1280 px
  - Rollback: Revert the commit; no data is affected. Gate checks stay on.
- [ ] **UI-T06** (T-906) Overlays: modal, toast with undo, side panel, banner; focus trap and return (M)
  - Feature: F-63 | Milestone: M-08 | Level: 3 | Lane: design
  - Needs: UI-T04 (T-904)
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer, gx-staff-reviewer
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: Focus stays inside an open modal and returns to the trigger; destructive action is never the default focus; toasts are announced politely
  - Tests: keyboard and screen-reader tests; axe
  - Rollback: Revert the commit; no data is affected. Gate checks stay on.
- [ ] **UI-T07** (T-907) App shell: global header, rail with pinned views and counts, tab bar, utility bar, responsive collapse (M)
  - Feature: F-64 | Milestone: M-08 | Level: 3 | Lane: design
  - Needs: UI-T05 (T-905)
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer, gx-staff-reviewer
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: Rail collapses to 48 px under 1100 px and to a menu under 720 px; skip link reaches main; header actions follow the placement table
  - Tests: responsive screenshots at 1440, 1280, 1024 and 720 px; keyboard pass
  - Rollback: Revert the commit; no data is affected. Gate checks stay on.
- [ ] **UI-T08** (T-908) Page templates: dashboard, list, record, settings with the 12-column no-gap grid (M)
  - Feature: F-64 | Milestone: M-08 | Level: 4 | Lane: design
  - Needs: UI-T07 (T-907)
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer, gx-staff-reviewer
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: Every grid row spans 12 of 12; cards in a row are equal height; no horizontal scroll at 1280 px
  - Tests: screenshot baselines in both themes; grid-sum lint
  - Rollback: Revert the commit; no data is affected. Gate checks stay on.
- [ ] **UI-T09** (T-909) Data table: sticky header, sort, selection, bulk bar, row menu, pager, density toggle, truncation (M)
  - Feature: F-65 | Milestone: M-08 | Level: 5 | Lane: design
  - Needs: UI-T05 (T-905), UI-T08 (T-908)
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer, gx-staff-reviewer
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: Selection count is announced; row actions sit in the last column; compact density gives 26 px rows; 10,000 rows page at 25 per page
  - Tests: component and keyboard tests; axe; performance check on 10,000 rows
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **UI-T10** (T-910) Charts: token colours, one accent series at most, text alternative for every chart (S)
  - Feature: F-65 | Milestone: M-08 | Level: 5 | Lane: design
  - Needs: UI-T08 (T-908)
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: Each chart has a caption or hidden table; series are distinguishable without colour; axis labels are 11 px
  - Tests: contrast check on series; axe
  - Rollback: Revert the commit; no data is affected. Gate checks stay on.
- [ ] **UI-T11** (T-911) Secure data display: masked fields with audited reveal, session-expiry and 401 handling, no-permission and error states (M)
  - Feature: F-65 | Milestone: M-08 | Level: 7 | Lane: design
  - Needs: UI-T09 (T-909), K7-T06 (T-097)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-ux-reviewer, gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S3. Threat: personal data exposed on screen or in storage. Control: masked by default, audited reveal, nothing sensitive in browser storage or URLs.
  - Done when: Masked field shows the last 4 characters; reveal writes 1 sensitive-read audit row; a 401 returns to sign-in with 0 tokens or personal data in browser storage
  - Tests: integration test with the audit fake; storage inspection test
  - Rollback: Revert the commit; no data is affected. Gate checks stay on.
- [ ] **UI-T12** (T-912) Design gates in CI: contrast audit, colour budget, no inline style, no raw hex, grid-sum lint (M)
  - Feature: F-66 | Milestone: M-08 | Level: 1 | Lane: design
  - Needs: UI-T01 (T-901)
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer, gx-staff-reviewer
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: A failing pair, a budget breach, an inline style or a raw hex each fail the build with the file named
  - Tests: one failing fixture per gate
  - Rollback: Revert the commit; no data is affected. Gate checks stay on.
- [ ] **UI-T13** (T-913) Accessibility scan and screenshot comparison in both themes for all templates (M)
  - Feature: F-66 | Milestone: M-08 | Level: 5 | Lane: design
  - Needs: UI-T08 (T-908), UI-T12 (T-912)
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer, gx-staff-reviewer
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: 0 serious or critical axe violations on 4 templates in 2 themes; screenshot diff under 0.1% against baselines
  - Tests: CI run on the reference templates
  - Rollback: Revert the commit; no data is affected. Gate checks stay on.
- [ ] **UI-T14** (T-914) Tenant branding: logo, product name and accent with save-time contrast validation (S)
  - Feature: F-67 | Milestone: M-08 | Level: 5 | Lane: design
  - Needs: UI-T04 (T-904), K1-T09 (T-023)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-ux-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S3. Threat: tenant branding breaks legibility or injects markup. Control: contrast validation at save, colour parsed to a fixed format, logo type and size checks, audited change.
  - Done when: An accent that fails 4.5:1 with midnight text or matches the danger hue is rejected with the reason; changes are audited
  - Tests: unit tests on the validator; audit-fake assertion
  - Rollback: Revert the commit; no data is affected. Gate checks stay on.
