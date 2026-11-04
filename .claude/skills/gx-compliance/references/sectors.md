# Sector packs (India focus; each needs fresh verification before a build in that sector)

Use these as a starting list of what to research, not as final requirements. Record what you
verified, from which official source, on which date.

## Health (clinics, telemedicine, health records)
- Health data is high-risk personal data under DPDP; treat with strict access control, audit and minimisation.
- Telemedicine Practice Guidelines, 2020 (registered medical practitioners, consent, identification,
  prescription limits by drug list, record keeping) — verify current version under NMC.
- ABDM (Ayushman Bharat Digital Mission): ABHA ids, consent-based health information exchange and the
  Health Data Management Policy if integrating with ABDM.
- Clinical Establishments rules (state-dependent), drug and pharmacy rules if dispensing.
- App stores: Apple and Google health-app policies (privacy labels, data safety form, medical disclaimers).
- Global: HIPAA (US) only if serving US covered entities.

## Finance (lending, wallets, investments, insurance, KYC)
- Payments: RBI PA/PG rules (india.md). Wallets/PPIs need RBI authorisation.
- Lending: RBI Digital Lending Guidelines, 2022 (loans disbursed and repaid between borrower and the
  regulated entity's account, key fact statement, cooling-off, data collection limits).
- KYC: RBI KYC Master Direction; Aadhaar use only as permitted (no storing Aadhaar numbers unless authorised; mask).
- Investments: SEBI regulations; insurance: IRDAI. Do not build regulated flows without a licensed partner.

## Energy and solar EPC
Mostly business-process rules the product should help users follow, plus data rules:
- MNRE: ALMM (Approved List of Models and Manufacturers) for modules and, from 1 June 2026, cells
  (List-II) for applicable projects — track model/make against the current list.
- PM Surya Ghar: vendor registration, portal application stages, subsidy disbursement, vendor
  obligations and deactivation rules — keep stage templates aligned with the current portal.
- State DISCOM net-metering/feasibility/inspection rules and timelines (vary by state and change);
  CEA safety regulations for electrical installations; BIS standards for equipment.
- Customer data: consumer number, address, electricity bills, bank details for subsidy — personal data under DPDP.

## EV (manufacturers, distributors, dealers, charging)
- Central EV incentive scheme rules current at launch (FAME II ended; PM E-DRIVE succeeded it — verify
  current scheme and documentation), state EV policies.
- Battery Waste Management Rules, 2022 (EPR for producers), vehicle homologation (AIS/BIS) for OEMs.
- Dealer data: customer KYC for vehicle registration (VAHAN), finance/insurance partners.

## Education and minors
- DPDP children's data rules (verifiable parental consent, no tracking/targeted ads at children; check exemptions for educational institutions).
- Exam/result data accuracy and access control; content and refund rules for paid courses (consumer protection).

## HR, payroll and workforce
- Employee data under DPDP (employment is a legitimate use for certain purposes), labour codes,
  EPF/ESI/PT/TDS calculations — use a licensed payroll provider or validated rules; audit every change.

## Marketplaces and logistics
- E-commerce rules, intermediary rules, GST TCS for e-commerce operators, e-way bills for goods movement.
- Gig/delivery partners: social security code provisions for platform workers (verify status), location data minimisation.

## Government buyers
- GIGW 3.0, security audits by CERT-In empanelled auditors, data localisation clauses, MeitY cloud empanelment.
