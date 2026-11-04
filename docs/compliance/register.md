# Compliance register: EPC dashboard

Engineering guidance, not legal advice. Last checked: **2026-11-04**. Everything marked **verify** needs a CA or lawyer before launch.
Rules are IDs `CMP-nn` (CMP-01 to CMP-30). A rule is "done" only when its test or evidence exists (skill `gx-compliance`, step 4).
Skill: `epc-compliance-privacy`. Data map: `data-inventory.md`. Incidents: `breach-runbook.md`.

## Key dates (as of the check date)

| Date | What starts | Source |
|---|---|---|
| 13 Nov 2025 | DPDP Rules, 2025 notified | [Protiviti](https://www.protiviti.com/sites/default/files/2025-11/flash_compliance_update_dpdp_rules-2025.pdf) |
| 14 Nov 2026 | Consent Manager provisions | [Mondaq](https://www.mondaq.com/india/privacy-protection/1709084/8-key-takeaways-the-digital-personal-data-protection-rules-2025) |
| 14 May 2027 | Most operational duties: notice, security safeguards, breach intimation, erasure | Mondaq; Protiviti (Rules 3, 6, 7, 8, 9, 10 to 16, 22, 23 within 18 months) |
| 1 Apr 2026 | E-invoicing for B2B suppliers above the turnover threshold (see CMP-23) | [Sansa Legal](https://www.sansalegal.com/post/gst-e-invoicing-april-2026-rs-5-crore-threshold-and-new-compliance-rules) |

**Decision: build to the 14 May 2027 standard from day one.** Launch will likely land before that date; retrofitting consent, logs and erasure later costs more than building them now.

## Our role

- **Tenant (the EPC) is the data fiduciary** for its customers' data: homeowners, businesses, their staff. **We are the processor.** A DPA is signed at onboarding.
- **We are the fiduciary** for: tenant staff login accounts, billing contacts, our own marketing and support data.
- Consequence: end-customer requests (access, correction, erasure) reach the tenant first. We provide the tools and deadlines (CMP-09).

## Rules

Status values: Not built, Built, Verified. All start at Not built (repo is empty).

### Personal data (DPDP, IT Act, CERT-In)

| ID | Rule | Source | Implementation and test | Status |
|---|---|---|---|---|
| CMP-01 | Tenant is fiduciary, we are processor. DPA at signup; public sub-processor list; processors only under a contract with security duties. | gx `india.md`; Protiviti | Signup blocks until DPA accepted (version stored). Test: tenant cannot activate without it. | Not built |
| CMP-02 | Every intake path records a notice version and consent: lead forms, public calculator, inbound WhatsApp, survey. Notice is plain language, itemises data and purpose, says how to withdraw and complain. Marketing consent is separate and never pre-ticked. | Mondaq (notice contents); gx `gx-compliance` | `consents` table: person, purpose, notice version, channel, timestamp, withdrawn_at. Notice templates in English, Hindi, Marathi, Gujarati. Test: no lead is saved without a consent row. | Not built |
| CMP-03 | Collect only fields in `data-inventory.md`. **Never store**: Aadhaar number, card numbers, CVV, a consumer's bank account (subsidy goes to the consumer, see CMP-27). ID proofs, if uploaded, are restricted files. | Product decision; RBI card rule (`india.md`); Aadhaar handling: **verify** | `privacycheck.py` flags these field names. Test: schema scan in CI. | Not built |
| CMP-04 | Security safeguards: encryption in transit and at rest, masking where shown, role-based access with tenant isolation, MFA for staff and admins, backups with a tested restore, monitoring, access logs. | Mondaq (minimum measures); Protiviti (Rule 6) | RLS on every tenant table; cross-tenant negative test per table; MFA enforced; quarterly restore drill. API security rules live in `gx-architecture/references/security.md`. | Not built |
| CMP-05 | Access and audit logs kept at least 1 year, in an Indian region, clocks on NTP. | Mondaq (1 year); CERT-In 2022 (180 days, India): **verify** | Log store with 400-day retention. Test: retention config assertion. | Not built |
| CMP-06 | Breach readiness. CERT-In report within 6 hours of noticing. Tell the Board and affected people without delay; detailed report to the Board within 72 hours. We tell the tenant immediately (propose 24 hours maximum in the DPA). | Mondaq; Protiviti; CERT-In: **verify** | `breach-runbook.md` plus an incident log table. Test: tabletop drill before launch. | Not built |
| CMP-07 | Retention and erasure. A schedule per data category, an automated job to delete or anonymise, and a 48-hour notice to the person before erasure where we act as fiduciary (for tenants: the hook they use). | Mondaq (48 hours); Protiviti (Rule 8) | Retention engine reads `data-inventory.md` values from config. Test: expired test record is removed and the notice event fires. | Not built |
| CMP-08 | Statutory records win over erasure. Invoices and books of account are kept 6 years (72 months) from the due date of the annual return. An erasure request anonymises everything else. | [GST Section 36](https://www.gstgyaan.com/section-36-period-of-retention-of-accounts-records) | Erasure flow skips statutory tables and says why. Test: erase a customer with invoices. | Not built |
| CMP-09 | Data requests desk: access, correction, erasure, grievance, nominee. Each request has an owner and a due date, routed to the tenant admin. Exports are machine-readable. | gx `india.md` | `data_requests` table and screen. Test: request lifecycle with SLA timer. | Not built |
| CMP-10 | Tenant exit: full export (CSV and JSON), then deletion within the DPA period, with a deletion record. | Processor duty (`india.md`) | Maps to F-114. Test: export then delete a sample tenant. | Not built |
| CMP-11 | No data of minors is collected. No tracking or targeting of children. | `india.md` (**verify** exemptions) | No household-member fields. Test: schema review. | Not built |
| CMP-12 | Hosting and processing in an Indian region. Any sub-processor outside India is listed and checked against the government's restricted list. | Protiviti (Rule 15) | Region pinned in infra config. `privacycheck.py` warns on foreign region strings. | Not built |
| CMP-13 | Staff location and attendance: only for work, only during check-in or shift, with a notice to staff. No off-duty tracking. Short retention. | DPDP employment use (`india.md`): **verify** | GPS captured on check-in and on job events only. Test: no background location calls. | Not built |
| CMP-14 | Call recording is off by default. If a tenant turns it on, the other party is told at the start and retention is limited. | RECOMMENDED | Flag per tenant, default off. | Not built |
| CMP-15 | Public links (customer tracking, quote accept, pay) use unguessable, expiring tokens, show the minimum data, and carry no personal data in the URL. No sequential ids. | Privacy by design | Test: enumerate ids, expect 404. `privacycheck.py` flags `?phone=` and `?email=`. | Not built |
| CMP-16 | No personal data in logs, error trackers or analytics. Phones and emails masked where logged. Third-party scripts only with a DPA and no personal data. | Privacy by design | `privacycheck.py` flags PII in log calls and tracker scripts. | Not built |
| CMP-17 | AI features: no customer personal data goes to a model provider without a DPA, disclosure to the tenant, and identifier stripping. The provider is a listed sub-processor. | RECOMMENDED | Applies to the v2 morning brief and any AI search. | Not built |

### Messaging

| ID | Rule | Source | Implementation and test | Status |
|---|---|---|---|---|
| CMP-18 | WhatsApp: opt-in captured per contact, approved templates outside the 24-hour window, opt-out honoured at once, marketing and transactional kept apart. | `india.md`: **verify** current Meta policy | Per-contact consent state gates every send. Test: send to an opted-out contact is refused. | Not built |
| CMP-19 | SMS: entity, sender ID and templates registered on DLT; promotional messages need consent and respect DND. | TRAI TCCCPR 2018 (`india.md`) | Send layer refuses unregistered templates. | Not built |
| CMP-20 | Email: SPF, DKIM, DMARC on the sending domain; one-click unsubscribe on marketing. | `india.md` | DNS checklist at tenant setup. | Not built |

### Money and invoices

| ID | Rule | Source | Implementation and test | Status |
|---|---|---|---|---|
| CMP-21 | Card data never touches us. Payments only through an RBI-authorised payment aggregator with hosted links. Store provider ids, reconcile daily, idempotent webhooks. | RBI (`india.md`) | Test: replay a webhook twice, one payment recorded. | Not built |
| CMP-22 | GST invoices carry supplier GSTIN, an unbroken series per financial year, HSN or SAC, taxable value, rate, and CGST/SGST or IGST by place of supply. Issued invoices are immutable; corrections are credit notes. | `india.md` | Test: editing an issued invoice is refused. | Not built |
| CMP-23 | E-invoicing applies to B2B supply when the supplier's turnover is above the threshold: above Rs 5 crore (FY 2025-26 test) from 1 Apr 2026. At Rs 10 crore or more, report within 30 days of the invoice date or the invoice is invalid for ITC. **B2C is out of scope**, so most residential rooftop jobs are not e-invoiced; C and I jobs may be. Per-tenant switch, IRN and QR fields ready, integration via a GSP or accounting export. | [Sansa Legal](https://www.sansalegal.com/post/gst-e-invoicing-april-2026-rs-5-crore-threshold-and-new-compliance-rules): **verify** with the tenant's CA | Feature flag per tenant. Test: B2B invoice over threshold cannot be finalised without an IRN. | Not built |
| CMP-24 | GST rates are data, never code. Renewable-equipment GST fell from 12% to 5% on 22 Sep 2025; one vendor blog puts the blended EPC rate near 8.9% under the 70:30 split. | [Reslink](https://www.reslink.org/blogs/two-policy-changes-that-are-improving-epc-margins-right-now/): **verify** with a CA | Rate table with effective dates. Test: invoice dated before and after a rate change. | Not built |
| CMP-25 | E-way bill when goods move above the value threshold. | `india.md`: **verify** threshold | Dispatch screen (F-46) prompts for it. | Not built |

### Sector and design

| ID | Rule | Source | Implementation and test | Status |
|---|---|---|---|---|
| CMP-26 | ALMM: module and cell make and model are checked against the current MNRE list where the project type requires it. The list is data with an as-of date. | gx `sectors.md`: **verify** (cells from 1 Jun 2026) | Warning on the quote line, not a hard block, until the list is confirmed. | Not built |
| CMP-27 | PM Surya Ghar: stage templates mirror the current national portal. The subsidy is credited to the consumer's account (or the loan account), so **we never hold subsidy money and never collect the consumer's bank details**. | [QuickEstimate](https://quickestimate.co/blog/pm-surya-ghar-disbursement-timeline) | Track subsidy status only (F-54). Test: no bank field in the schema. | Not built |
| CMP-28 | Accessibility to WCAG 2.2 AA. | `india.md` | Enforced in the design system. | Not built |
| CMP-29 | No dark patterns in customer-facing flows: no false urgency on quote validity, no hidden fees, easy withdrawal of consent. | CCPA Dark Patterns Guidelines 2023 (`india.md`) | Review step in `gx-ux-reviewer`. | Not built |
| CMP-30 | AI connector access (Claude, ChatGPT via MCP) is opt-in per tenant admin, per-user OAuth, read and draft only, fully audited, rate-limited. Tool output is treated as untrusted data and never returns never-store fields. Data sent to the user's own AI provider is disclosed in the DPA and tenant notice. | ADR-0005; Claude connector docs; CMP-04, CMP-16, CMP-17 | Admin switch default off. Test: tool call without permission or with the switch off is refused; tool output contains no never-store fields. | Not built |

## Stop and ask Aadarsh first

Taking or holding customer money; storing any ID number or bank detail; biometric data; call recording turned on by default; sending customer data to a model provider; hosting outside India; anything that cannot meet a rule as written.
