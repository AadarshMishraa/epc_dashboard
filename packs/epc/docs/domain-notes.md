# Domain notes for agents

Short, sourced facts an agent needs before touching EPC logic. Where a figure comes from a vendor page it is marked. Confirm anything marked verify with the design partner or a chartered accountant before it drives a rule. Last checked 2026-11-04.

## The business in one paragraph

An Indian solar EPC sells and installs rooftop systems (residential, commercial, 100 kW and above), buys panels, inverters and structure from suppliers, files approvals with the state distribution utility and the national subsidy scheme, installs with its own and subcontracted crews, bills in milestones and collects. Cash gets stuck after installation while utility approvals (net meter, inspection, commissioning) age. Most small and mid-size EPCs run this on Excel, WhatsApp and Tally.

## Stage flow the pack models

Won deal, baseline, buy material, receive and inspect, readiness check, install and quality check, commissioning and handover, invoice and collect, close job and final margin. The utility and subsidy track runs in parallel because a finished job earns nothing until the utility acts. Steps 3 to 9 and the utility stages can each raise an exception.

## Rules the build must keep

1. Won means the customer accepted and paid the advance, not a verbal yes (owner-day feature map).
2. Subsidy is credited to the consumer's account (or loan account), so it is never a receivable of the EPC and a customer waiting for subsidy is not a late payer (CMP-27; vendor guidance, verify).
3. Commitment (purchase order), actual (bill or expense) and payment are three events; never count a rupee twice.
4. Amounts are integer paise. Invoice and receipt records are never edited; corrections are linked credit-note records.
5. GST rates, HSN and SAC codes are dated data. Renewable equipment GST fell from 12% to 5% on 22 September 2025; a vendor blog puts the blended EPC rate near 8.9% under a 70:30 goods and services split; a chartered accountant must confirm before launch (CMP-24).
6. Since 1 June 2026 net-metering and open-access projects must use domestic ALMM List-II cells (about 3,000 rupees per kW more, industry estimates). Flags are data; the rule will change (verify).
7. MNRE deactivated vendors for hoarding applications and advises no application pending over 60 days: the backlog widget warns before day 60.
8. Utility and subsidy portals have no public API and the pack never stores the owner's portal passwords: people record stage, reference number and evidence.
9. Do not store Aadhaar numbers, card numbers or a consumer's bank account (CMP-03).
10. A business customer may deduct tax at payment, so cash received is less than the invoice. The deduction settles the invoice but is not cash and not an overdue amount; it stays a claim until its certificate arrives. Deduction types and rates are dated data that a chartered accountant confirms (Q-13, CR-001). Store a certificate reference, never the payer's tax identity number. Tax the company deducts from its own suppliers stays in Tally (X-09).
11. Money paid to a supplier before the bill is an advance: not a commitment, not actual cost and not the settlement of a liability. A bill applies it first; if the order is cancelled it becomes a refund due from the supplier (CR-001, verify with owners that suppliers ask for advances).
12. A commercial job follows its own approval track. The system size a utility accepts is limited by the sanctioned load, and the metering route depends on size against the state's net-metering limit. Tracks, limits and routes are data per state, marked unverified until the design partner confirms them (CR-001).
13. A complaint under the scheme has a reply window. The 15-day figure comes from a search summary and the day count (calendar or working) and start date are unverified, so both are data (Q-14, CR-001).

## What is evidence and what is hypothesis

- Evidence (vendor-run survey, sample size not stated): utility delays are the top pain at 71% of installers; price pressure 66%; follow-up 63%; subsidy paperwork 56%; working capital 52%. 64 to 70% of solo and small EPCs run the pipeline in Excel or Sheets and 96 to 98% talk to customers on WhatsApp.
- Hypotheses to test in Phase 0: procurement and BOM control is a top pain for mid-size EPCs; owners will pay about 5,000 rupees per company per month; supervisors will update from a phone; one or two states cover the first customers.

## Competitors (public pages, no demos run)

Quickest Solar CRM, SolarOps360 (nearest rival: similar price and scope, thin public evidence of depth), Sunbase, SurgePV, OpenSolar, Zoho or Salesforce with configuration, Udyog Software and similar Indian ERPs, Tally Prime, in-house builds, and Excel with WhatsApp. None shows quote to purchase order to receipt, job-level forecast margin and utility-stage tracking together on public pages. The defence is India depth: state stage templates, ALMM and DCR flags, Tally sync.

## Sources

Earlier research documents in this project: "Solar EPC Operations Dashboard: Research and PRD" (27 October 2026), "EPC Dashboard: Feature Map" and "Build Plan: EPC Operations Dashboard". Compliance: docs/compliance/register.md. Industry changes: the weekly industry brief (skill epc-industry-news).
