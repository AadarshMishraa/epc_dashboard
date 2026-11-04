# India: cross-industry rules (engineering view; verify before launch)

## Digital Personal Data Protection Act, 2023 + DPDP Rules, 2025
Status: Rules notified November 2025 with staggered commencement; most fiduciary obligations
commence about 18 months after notification. **Verify** the exact commencement dates and the final
rule text (timelines below are from the Act/Rules as understood; confirm numbers).
- Lawful basis: consent, or a listed "legitimate use" (e.g. a user voluntarily giving data for a
  specified purpose, employment purposes, legal obligation).
- Notice: itemised data, purpose, how to withdraw consent and exercise rights, how to complain to the
  Data Protection Board; clear and plain language; available in English or a language of the Eighth
  Schedule on request.
- Consent: free, specific, informed, unconditional, unambiguous, by clear affirmative action, limited
  to the necessary data; withdrawal as easy as giving. Consent Managers are a registered role under the Rules.
- Duties: accuracy (where data is used for decisions or shared), reasonable security safeguards,
  erasure when the purpose is served or consent withdrawn (unless law requires retention), contracts
  with processors, grievance redressal, a published contact for queries.
- Breach: intimate the Board and each affected data principal; the Rules set the content and a
  detailed report timeline (the draft set 72 hours to the Board) — **verify**.
- Children (under 18): verifiable parental consent; no tracking, behavioural monitoring or targeted
  advertising directed at children (exemptions per the Rules for some classes, e.g. health, education — **verify**).
- Rights: access a summary, correction and erasure, grievance redressal, nominate a person.
- Significant Data Fiduciaries (notified by government): DPO in India, independent audit, DPIA.
- Cross-border: permitted except to countries the government restricts by notification.
- Penalties: up to ₹250 crore for failure of security safeguards; other breaches have lower caps.
- B2B SaaS: usually a processor for customer data. Provide a DPA, follow instructions, assist with
  rights requests and breaches, delete/return data at contract end.

## IT Act, 2000 and SPDI Rules, 2011
Section 43A and the SPDI Rules (privacy policy, consent for sensitive data, reasonable security such
as ISO 27001) apply until superseded by DPDP commencement. **Verify** status for the launch date.

## CERT-In Directions (28 April 2022)
- Report specified cyber incidents to CERT-In within **6 hours** of noticing them.
- Maintain ICT system logs for **180 days**, within Indian jurisdiction, and provide on request.
- Synchronise system clocks with NTP servers of NIC or NPL (or traceable to them).
Engineering: centralised logs with 180-day retention in an Indian region; incident runbook with the 6-hour clock; NTP config.

## Intermediary rules (IT Rules, 2021)
If the product hosts or transmits third-party user content (marketplace listings, reviews, chat):
publish terms and privacy policy, appoint a grievance officer, acknowledge complaints within 24 hours
and resolve within 15 days, act on unlawful-content orders. Larger "significant social media
intermediaries" have more duties.

## Consumer protection
- Consumer Protection Act, 2019 and Consumer Protection (E-Commerce) Rules, 2020 for marketplaces
  and online sellers: seller and grievance officer details, clear prices including all charges,
  return/refund/cancellation terms, no manipulated reviews.
- Guidelines for Prevention and Regulation of Dark Patterns, 2023 (CCPA): bans false urgency, basket
  sneaking, confirm-shaming, forced action, subscription traps, interface interference, bait and switch,
  drip pricing, disguised ads, nagging, and others. Design reviews must check for them.

## Payments (RBI)
- Accept payments only through an RBI-authorised payment aggregator (Razorpay, Cashfree, PhonePe PG, etc.).
- Merchants must not store card numbers; card-on-file is tokenised by the network/issuer. Use hosted
  checkout or provider SDK fields so card data never touches our servers.
- Recurring payments: e-mandate framework (additional factor authentication at registration,
  pre-debit notification before each debit; limits above which AFA is needed per debit — **verify** current limits).
- Payment system data localisation (RBI, 2018) binds payment system operators; in practice choose
  Indian PAs and keep payment records in India.
- Refunds and reconciliation: store provider ids, reconcile daily, idempotent webhooks.

## GST invoicing
Tax invoice contents (supplier GSTIN, invoice number series per financial year, date, recipient
GSTIN if registered, HSN/SAC, taxable value, rate, CGST/SGST or IGST by place of supply). E-invoicing
via IRP is mandatory above an aggregate turnover threshold (₹5 crore as of 2023 — **verify**);
e-way bills for goods movement above the value threshold (**verify**). Prefer integration with the
customer's accounting system (Tally, Zoho Books) or a GSP over building filing yourself.

## Messaging
- SMS: TRAI TCCCPR, 2018. Register the business entity, sender headers and message templates on DLT;
  transactional vs service vs promotional categories; promotional needs consent and respects DND.
- WhatsApp Business: opt-in required, approved templates outside the 24-hour customer-service window, honour opt-out.
- Email: unsubscribe for marketing; authenticated sending domain (SPF, DKIM, DMARC).

## Accessibility
Rights of Persons with Disabilities Act, 2016; GIGW 3.0 for government and public-sector sites;
WCAG 2.2 AA as the engineering bar for everything else.

## Records and employment (only if relevant)
Statutory registers and payroll (labour codes, EPF, ESI) if building HR/payroll; retain financial records
for the period the Companies Act and GST law require (**verify** periods per document type).
