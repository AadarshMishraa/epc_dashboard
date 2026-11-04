---
name: gx-compliance
description: Work out which laws, regulations and standards apply to a product or feature (India first, then sector and global) and turn them into build requirements - personal data under DPDP, security incident rules, payments, invoicing, messaging, consumer and dark-pattern rules, accessibility, and sector rules for health, finance, energy, EV and others. Use when collecting, storing or sharing personal data, taking payments, sending SMS/WhatsApp/email, entering a regulated industry, selling to enterprises, or launching in a new country.
---

# Compliance

This is engineering guidance, not legal advice. Laws and thresholds change: anything marked
**verify** must be checked against the current official text or with counsel before launch, and the
date checked recorded in `.claude/memory/DECISIONS.md`. Project compliance skills (e.g.
`drincity-compliance`) override this for their project.

References: `references/india.md` (cross-industry Indian law), `references/sectors.md` (health,
finance, energy/solar, EV, education, HR, logistics), `references/global.md` (GDPR, US, UAE/KSA,
Australia, enterprise standards).

## Step 1 — Classify the product (write the answers into the plan)
1. **Whose data?** Customers' end users, our customers' staff, minors (under 18 in India), patients, employees.
2. **What data?** Contact, location, ID numbers (Aadhaar, PAN), financial, health, biometric, children's, images/video, device data.
3. **Our role:** data fiduciary (we decide purpose) or data processor (we process for a customer, as in most B2B SaaS). B2B SaaS is usually a processor for customer data and a fiduciary for its own user accounts and marketing.
4. **Money?** Collecting payments, recurring billing, payouts, wallets, lending, invoicing.
5. **Messaging?** SMS, WhatsApp, email, push; transactional vs promotional.
6. **Sector?** Health, finance, energy, EV, education, government, HR/payroll, marketplace.
7. **Where?** Where users are and where data is stored and processed (cloud regions, sub-processors).
8. **Who buys?** Enterprise buyers will ask for security questionnaires, DPAs, SOC 2/ISO 27001.

## Step 2 — Pull the requirements
From the references, list each applicable rule as a requirement with: source, what it requires,
how we implement it, how we test it, status. Put it in `docs/compliance/register.md`.

## Step 3 — Build-time defaults that satisfy most regimes
- **Minimise**: collect only what the feature needs; mark each personal field with purpose and retention.
- **Notice and consent** (where consent is the basis): plain-language notice, separate purposes, not pre-ticked, withdrawal as easy as giving, consent record stored (who, what version, when, how).
- **User rights**: export, correction, deletion, grievance contact, implemented as working flows, not email promises.
- **Retention**: automatic deletion/anonymisation when the purpose ends; documented schedule.
- **Security**: encryption in transit and at rest, RLS/authorization, MFA for staff, least privilege, audit logs, backups (`gx-architecture/references/security.md`).
- **Breach readiness**: incident runbook with the reporting clocks (see india.md), contact list, log retention that can answer "what happened".
- **Processors and sub-processors**: DPA with every vendor touching personal data; public sub-processor list for B2B.
- **No dark patterns**: honest defaults, easy cancellation, no fake urgency or hidden costs.
- **Accessibility**: WCAG 2.2 AA as the standard.

## Step 4 — Evidence
Every requirement in the register links to code, a test, a config, or a document. "We comply" without
evidence is a finding.

## Stop and escalate
Health data handling, lending, payments outside an authorised aggregator, children's data,
biometric data, cross-border transfer to a restricted country, government contracts, or any
requirement you can't implement as written.
