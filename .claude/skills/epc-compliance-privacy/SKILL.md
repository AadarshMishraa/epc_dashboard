---
name: epc-compliance-privacy
description: Project compliance and data-privacy rules for the EPC (solar/EV distributor) dashboard - DPDP, CERT-In, consent, retention and erasure, GST invoicing and e-invoicing, payments, WhatsApp/SMS, ALMM and PM Surya Ghar. Use before touching any personal data, lead capture, customer-facing link, message send, invoice, payment, subsidy tracking, staff location, file upload, logging, analytics, AI feature, tenant onboarding or exit. Overrides the universal gx-compliance where they differ.
---

# EPC dashboard: compliance and privacy

Engineering guidance, not legal advice. The rules live in `docs/compliance/register.md` (IDs `CMP-01..30`).
Data map: `docs/compliance/data-inventory.md`. Incidents: `docs/compliance/breach-runbook.md`.
Universal background: `gx-compliance` (references/india.md, sectors.md). This skill wins on conflict.

## Our position (settled)
- Tenant (the EPC) = fiduciary for its customers' data. We = processor. We are fiduciary only for tenant staff accounts, billing contacts and our own marketing.
- Build to the **14 May 2027** DPDP standard now (notice, safeguards, breach, erasure). Do not wait for the date.
- Hosting and processing in India.

## Before you write code that touches any of these, do the check

| You are about to... | Read rule | Must be true |
|---|---|---|
| Add a field that holds personal data | CMP-03, data-inventory | Row exists in the inventory; purpose, access, retention filled; not on the never-store list |
| Add a lead/intake path (form, WhatsApp, calculator, survey) | CMP-02 | Notice version + consent row saved; marketing consent separate, unticked |
| Send WhatsApp / SMS / email | CMP-18..20 | Per-contact consent gate; approved/DLT template; opt-out honoured; transactional vs promotional split |
| Create a customer-facing link (track, quote accept, pay) | CMP-15 | Unguessable, expiring token; minimum data; no PII in the URL |
| Log, trace, or send analytics | CMP-16 | No raw phone/email/address; masked ids only; no third-party tracker without DPA |
| Add a table | CMP-04 | Tenant id + RLS; cross-tenant negative test |
| Store or show a document/photo | CMP-04, data-inventory | Private bucket, signed short-lived URLs, role-gated; ID proofs restricted |
| Build erase/export/delete | CMP-07..10 | Retention job; 48-hour notice event; statutory tables (invoices, books) kept 6 years and the reason shown; tenant exit export |
| Build invoicing / payments | CMP-21..25 | Immutable issued invoices (credit notes); GST rates as dated data; hosted payment links only; idempotent webhooks; e-invoicing is a per-tenant switch |
| Build subsidy tracking | CMP-27 | Status only; **no consumer bank details**; we never hold subsidy money |
| Capture staff location/attendance | CMP-13 | Only on check-in/job events; staff notice; short retention |
| Add an AI feature | CMP-17 | Identifiers stripped; provider listed as sub-processor; tenant told |
| Expose a tool to Claude/ChatGPT (MCP) | CMP-30, CMP-17 | Admin switch, per-user OAuth, read/draft only, audited, no never-store fields |
| Add a vendor/SDK/sub-processor | CMP-01, CMP-12 | DPA; India region or checked against the restricted list; added to the public sub-processor list |

## Flow
1. Classify the change with the table. If no row applies, say so in the plan and move on.
2. Put the rule IDs in the plan (`docs/plans/`) and the PR description.
3. Implement; add the test the register names (the "Implementation and test" column). A rule is done only with that test or evidence; update its Status in the register (Not built, Built, Verified).
4. Run `python3 .claude/gx/bin/privacycheck.py` (CI runs it with `--strict`). For prose that names a never-store field (a rule, not a field) in docs or `tools/plangen/`, add `privacycheck: allow CMP-03 <reason>` on that line; it never covers an identifier such as `aadhaar_no`, and CI prints every ALLOW line. `privacycheck:ignore` (any rule) needs a reason in the PR. Tests: `python3 .claude/gx/bin/test_privacycheck.py`.
5. A new compliance fact or a changed law goes into the register with the date checked and its source; a decision goes into `.claude/memory/DECISIONS.md`.

## Stop and ask Aadarsh first
Holding customer money; storing any ID number or bank detail; biometrics; call recording on by default; customer data to a model provider; hosting outside India; any rule that cannot be met as written. Children's data: do not collect (CMP-11).

## Items marked **verify** (need a CA or lawyer before launch)
CERT-In 6-hour scope and 180-day log rule; Aadhaar handling; e-invoicing threshold applicability per tenant (CMP-23); blended GST rate (CMP-24); e-way bill threshold (CMP-25); ALMM cell scope and dates (CMP-26); staff-data retention (CMP-13); WhatsApp policy changes (CMP-18).
