# E9 Email, export, Tally and WhatsApp

Message adapters, export everything, Tally sync and sync health.

- **Lane:** `packs/epc/epc-integrations`
- **Tasks:** 6
- **Foundation waves needed:** 0, 1, 2, 5

Tick a task when its done-when and tests pass and the definition of done in [the playbook](README.md) holds. Scope and acceptance criteria live in [the pack PRD](../prd/01-prd.md).

## Features delivered

- **F-54** Email sending (Must, 3 acceptance criteria)
- **F-55** Export everything (Must, 4 acceptance criteria)
- **F-56** Tally sync (Should, 0 acceptance criteria)
- **F-57** WhatsApp messaging (Should, 0 acceptance criteria)

## Security baseline for this module

Applies to every task below, on top of the repository [security guidelines](../../../../docs/guidelines/security-guidelines.md).

- Every pack table has a tenant, forced row-level security and a negative cross-tenant test; the app role is not the owner.
- Every new action is a declared permission with a negative test (caller without it is denied); the server decides, the interface only hides.
- Every new field has a data class; personal data is masked in logs and audit diffs and has an erase and export handler.
- Amounts are integer paise; issued invoice and receipt records are never edited, only corrected by linked records.
- Files, links and imports are untrusted input: type, size and content checks, signed short-lived access, no personal data in URLs.

## Tasks

- [ ] **E9-T01** (T-091) Email sender (M)
  - Feature: F-54 | Milestone: M-03 | Pack wave: A | Level: 0 | Lane: epc-integrations
  - Needs: none
  - Foundation features used (public APIs only): F-02 (needs foundation wave 0)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: provider adapter behind the message-sender port with templates, retries and a domain setup check
  - Tests: send once on retry; SPF, DKIM and DMARC check; no secrets in logs
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E9-T02** (T-092) Export everything (M)
  - Feature: F-55 | Milestone: M-06 | Pack wave: D | Level: 3 | Lane: epc-integrations
  - Needs: E0-T11 (T-011)
  - Foundation features used (public APIs only): F-54, F-58 (needs foundation wave 5)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: bulk exfiltration and spreadsheet formula injection. Control: permission and step-up, audited job, neutralised cells, short-lived signed link, tenant-scoped file.
  - Done when: audited job exports every table, attachment and history as CSV and JSON with checksum; link valid 5 minutes
  - Tests: formula neutralised; permission denial audited; link expiry; tenant isolation of the file
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E9-T03** (T-093) Tally export (M)
  - Feature: F-56 | Milestone: M-07 | Pack wave: A | Level: 15 | Lane: epc-integrations
  - Needs: E7-T02 (T-079), E6-T05 (T-075)
  - Foundation features used (public APIs only): F-02 (needs foundation wave 0)
  - Agents: build Aadarsh decides, then gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: accounting credentials or vouchers leak. Control: file exchange first; secrets only through the secrets port; nothing sensitive in the browser.
  - Done when: vouchers and bills as Tally-readable files; credentials never stored in the browser
  - Tests: file format fixtures; secret handling test; human gate on the Tally version
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
  - Human gate: Decide Q-08 and confirm the Tally version and file format with the design partner's accountant.
- [ ] **E9-T04** (T-094) Tally import and reconcile (M)
  - Feature: F-56 | Milestone: M-07 | Pack wave: A | Level: 16 | Lane: epc-integrations
  - Needs: E9-T03 (T-093)
  - Foundation features used (public APIs only): F-14 (needs foundation wave 2)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S2. Module security baseline applies.
  - Done when: ledger and payment status imported; unmatched records queued for reconcile
  - Tests: mismatch fixture; idempotent import
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E9-T05** (T-095) Sync health (S)
  - Feature: F-56 | Milestone: M-07 | Pack wave: A | Level: 17 | Lane: epc-integrations
  - Needs: E9-T04 (T-094)
  - Foundation features used (public APIs only): F-65 (needs foundation wave 1)
  - Agents: build gx-implementer | tests - | review gx-ux-reviewer
  - Skills: gx-cognitive-ux, epc-design-system, gx-code-quality, gx-test-feature
  - Security: S1. Module security baseline applies.
  - Done when: last sync time, failures and unmatched count on the home
  - Tests: stale label after 24 hours
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
- [ ] **E9-T06** (T-096) WhatsApp adapter (M)
  - Feature: F-57 | Milestone: M-07 | Pack wave: D | Level: 1 | Lane: epc-integrations
  - Needs: E9-T01 (T-091)
  - Foundation features used (public APIs only): F-02, F-51 (needs foundation wave 5)
  - Agents: build Aadarsh decides, then gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: messaging without consent or with leaked tokens. Control: per-contact opt-in, template-only outside the window, opt-out at once, secrets through the secrets port (CMP-18).
  - Done when: provider adapter with per-contact opt-in, approved templates, opt-out honoured at once
  - Tests: opt-out test; template-only outside the window; secrets only through the secrets port; human gate on provider and cost
  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag.
  - Human gate: Decide Q-09 (provider and who pays per message) and confirm the customer's verified business number.
