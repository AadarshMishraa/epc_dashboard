---
title: Competitive and UX research, Indian solar EPC software
date: 2026-11-04
author: gx-analyst
scope: EPC pack (packs/epc/docs/prd/01-prd.md), owner dashboard and post-sale control
source-status: partly-inferred
verification: no page was opened in this session (web fetch blocked for every host tried); every sourced claim comes from search-engine summaries of the linked pages
---

# Competitive and UX research: Indian solar EPC software (November 2026)

## 0. How to read this file

- Users: owners (U-01) of Indian solar EPCs with 10 to 40 live jobs, plus PM, procurement, store, site, finance, sales and service staff (U-02 to U-08).
- What the pack must do: after the sale, show the owner what is stuck, why, who owns it and what it costs, with numbers they can trust.
- Evidence tags:
  - `S` means the claim comes from a search-engine summary of the linked page, run on 2026-11-04. The page itself was **not opened**, because WebFetch failed DNS for quickestimate.co, capterra.in, g2.com and heavengreenenergy.com, and the session forbids further hosts. Every `S` claim is therefore **UNKNOWN - REQUIRES VERIFICATION** and is a lead, not a citation. Open the page before a claim drives a rule or a sales message.
  - `INFERRED` means analyst reasoning from the `S` claims and the PRD.
  - No claim here is `OBSERVED`.
- Most product facts come from vendor blogs written by rivals: Quickest, SurgePV, Sunbase, Heaven Green, Qbits. Treat every rival's comparison table as marketing.
- Sources are numbered [S1] to [S55] in section 9.
- Not repeated here: the PRD goals, the user table, the domain rules in `domain-notes.md`, or the existing competitor line.

## 1. (a) Comparison table

Legend: `?` = not found in search; `claim` = vendor says so, unverified.

| Product | Target customer | Modules (public) | Price (public) | Mobile / offline | Languages | WhatsApp | Tally / GST | DISCOM / PM Surya Ghar | Dashboard | Tag |
|---|---|---|---|---|---|---|---|---|---|---|
| Quickest Solar CRM (quickestimate.co, sister of SurgePV) | Indian residential and small installers | Leads, proposals with subsidy auto-calc, net metering, 25-year savings, branded PDFs | Free plan with 10 proposals a month; Pro ₹6,999 per user per year, 3-user minimum [S1] | ? | Hindi blog exists [S2] | Core on English pages; Hindi blog says not in the free plan (contradiction) [S1][S2] | Claims Tally, Zoho, Razorpay, IndiaMART, Meta and Google integrations [S1] | Subsidy calculation in the proposal only [S1] | ? | S |
| SurgePV | Design and proposal for Indian EPCs | Design, BOM pricing, subsidy calculation, quotations in Indian languages with WhatsApp templates [S3] | Conflicting: $1,299 per user per year; ₹1.07 lakh per user per year; ₹1,57,000 a year for 3 users [S5][S3] | ? | Multiple Indian languages for quotes [S3] | Templates [S3] | ? | Compliance guides; "not a CRM" per a rival review [S5] | ? | S |
| Sunbase | Residential installers | CRM, design; claims "subsidy & DISCOM document tracking", "enquiry to subsidy credited" pipeline [S7][S8] | Not public | Claims "mobile-first field access" [S7] | ? | Claims integration [S7] | Not found | Claims document tracking [S7] | ? | S |
| Arka360 | Designers, installers, sales | Design, proposals; a PM Surya Ghar plan [S9] | ₹46,000 to ₹1,00,000 a year plus 18% GST; single-line diagram (SLD) only in Premium (third-party review) [S10] | ? | ? | ? | ? | Plan "aligned with" the scheme; tracking not confirmed [S9] | ? | S |
| Solar Ladder | Indian installers and EPCs; 250+ customers incl. Mahindra Solarize, Fourth Partner [S14] | CRM, proposals, project management, procurement, O&M, financing (working capital and customer loans) [S12][S15] | Not public [S13] | iOS app exists | ? | ? | Not found | ? | ? | S |
| SolarOps360 | Indian EPCs, rooftop and C&I developers | 5 modules: GPS attendance and payroll, project stages from survey to handover (configurable), inventory, quotes and invoices with milestone tracking and P&L, free subsidy checker [S6] | From ₹6,999 flat; free version and trial [S6] | ? | ? | ? | ? | Configurable stages (not scheme-specific) [S6] | P&L report [S6] | S, 0 reviews [S6] |
| OpenSolar | Global installers, 28,000+ in 185+ countries | Leads, design, sales, install, service | Free; paid by hardware and finance partners [S16] | ? | ? | ? | ? | "Manual" India compliance per a rival [S17] | ? | S |
| Aurora Solar | US design and sales teams | Design, proposals | Quote only; about $159 to $259 per user per month per a rival [S18] | ? | English | No | No | No | ? | S |
| Enerflo | US residential sales orgs | Sales, CRM, proposals | ? | ? | English | No | No | No | ? | S [S19] |
| Scoop Solar | US solar install and project management, mobile crews | Project management, field forms | From $695 a month; no trial [S21] | Mobile-worker focus [S20] | English | No | No | No | ? | S, 4.5 from 23 reviews [S20] |
| Zoho CRM or Bigin, configured | Indian SMEs; some EPCs | Generic CRM plus Zoho Inventory | ₹800 to ₹2,100 per user per month per a rival [S4]; 2 to 6 weeks of setup per a rival [S1] | Yes (Zoho apps) | Yes | Via extensions | Zoho Books, not Tally | Custom only | Custom | S [S22][S23] |
| Salesforce, configured | Larger EPCs | Not researched in this pass | - | - | - | - | - | - | - | UNKNOWN |
| Udyog solar ERP | Mid and large EPC, O&M, utility-scale | Budget versus actual, material, labour and subcontract costing, "real-time margin" [S24] | Quote only [S24] | ? | ? | ? | ERP books (on-premise per Capterra); Tally link not found | ? | Margin view [S24] | S |
| Powerplay (general construction) | Indian contractors and builders | Site progress, material on site, labour, project-linked working-capital credit [S25] | ? | Phone first | Indian languages claimed | ? | ? | No | Progress | S |
| Odoo or ERPNext solar apps | Partner-built | Generic ERP with solar fields | Varies | - | - | - | - | - | - | S [S24 results] |
| Tally Prime with add-ons | All EPCs keep books here | Accounting; no solar-specific add-on found | - | - | - | - | Native | - | - | S |

Readings, all `INFERRED`:
1. The India-native field splits in two. Proposal and CRM tools (Quickest, SurgePV, Arka360, Sunbase) stop at the signed deal. Ops platforms (Solar Ladder, SolarOps360) cover project and inventory. **None shows public evidence of** scheme rule clocks, portal evidence quality, serial pre-checks, or forecast margin per job tied to purchase orders.
2. Price anchors: ₹6,999 per user per year (Quickest Pro) and ₹6,999 flat (SolarOps360). The pack's hypothesis of ₹5,000 per company per month (Q-06) is about 9 times Quickest Pro for 3 users. It must sell on cash recovered and deactivation avoided, not on features.
3. US tools (Aurora, Enerflo, Scoop) have no India stage, GST or WhatsApp depth. They are not rivals for this buyer, though Scoop's mobile-crew framing is a UX reference.

## 2. (b) Recurring complaints and user voice

There was very little first-hand user voice. G2, Capterra, Play Store and Reddit pages could not be opened. Search found no Reddit threads and no Solar Ladder Play Store reviews. Everything below is `S`.

**Software complaints (thin sample)**

| Theme | Snippet | Source |
|---|---|---|
| Hidden pricing slows evaluation | Aurora: "contact sales for all pricing", a "friction point"; Solar Ladder publishes no price | [S18][S13] |
| Missing features and design issues | Arka360 on G2: cons are "Missing Features (6 reviews), Design Issues (4 reviews)" | [S11] |
| Learning curve | Enerflo: "took me a while to understand how to use the platform"; Arka360: "did take some of my time to get familiar" | [S19][S11] |
| Follow-ups lost without a system | Indian EPC on Bigin: "many leads and referral which we miss following up" | [S22] |
| Site teams abandon complex software | "falling back to WhatsApp and Excel within 3 months"; "If it lags or crashes on a ₹10,000 phone, your supervisors will stop using it within a week" (vendor blog) | [S26] |
| Plan contents unclear | Quickest's free plan: WhatsApp and subsidy calculation are in or out depending on which page you read | [S1][S2] |

**Operational complaints (trade press quoting installers)**

| Theme | Snippet | Source |
|---|---|---|
| Portal edits locked | Installers "could not edit capacity details after submission"; others could not track applications | [S27] |
| Feasibility stalls | "in some places, it takes a month for the feasibility check"; about 7,000 feasibility requests pending in one Kerala DISCOM | [S27][S28] |
| Subsidy not paid | Rajasthan association: "Not even a single subsidy payment for projects installed after mid-February has been disbursed" | [S29] |
| Serial blocks commissioning | "serial number already exists" message blocked net metering and commissioning | [S55] |
| Margin squeeze | Punjab (2020): "at Rs 37,000 we are not getting any margins"; "some of them had to go out of business due to payment delays" | [S45] |
| Rule-change losses on signed work | MP: the domestic-cell (DCR) rule raised costs 30 to 35%; "tenders were awarded at lower rates months ago"; ₹40,000 to ₹50,000 extra on a 5 kW system | [S40] |
| Customer cannot fund the gap | Sirsa: 16,316 applications, 580 installed; the subsidy comes after installation, so the buyer pays the full cost upfront | [S46] |
| Loans and utilities slow | About 3 in 5 applications not yet approved and about 7% rejected (government data via Reuters) | [S47] |

## 3. (c) Gaps no product covers well (all INFERRED from the absence of public evidence)

1. **2026 scheme rules as clocks.** MNRE added hard clocks this year:
   - a 60-day advisory on holding applications [S31];
   - a 15-day window to fix defects found in field quality inspections (FQI), with geo-tagged, time-stamped proof [S33][S34];
   - a 15-day window to answer complaints under the vendor-violation SOP, with deactivation for one month [S32];
   - 66 vendors deactivated in August 2026 [S30].

   No product shows a "vendor standing" view. Deactivation stops new consumer applications [S30], which hits sales, not just operations.
2. **Waiting on the consumer as a named party.** Since September 2026 the consumer must approve the agreement in their own portal login before "Upload Installation" unlocks, and any later edit voids the approval [S35][S36]. Tools model DISCOM waits, not consumer waits.
3. **Serial and DCR certificate pre-checks.** Since 26 May 2026 the portal rejects repeated module or inverter serials with no undertaking route. Module serials come from the 16-digit DCR certificate number; inverter serials are typed by hand [S37][S38]. No tool checks before submission.
4. **Portal-grade evidence.** Proof photos must carry location and time [S33][S34]. Rejections come from blurry or wrong-page uploads and from name mismatches [S50][S51]. Generic photo upload does not prove capture time or place.
5. **Rule-change margin exposure on the signed backlog.** No product re-costs signed but uninstalled jobs when a dated rule changes cost, such as DCR [S40].
6. **Subsidy route per job.** In the utility-led aggregation (ULA) model, the central subsidy (CFA) goes to the **vendor's** bank account after a single post-commissioning release [S43][S44]. Under consumer-led PM Surya Ghar it goes to the consumer. No tool separates these routes.
7. **Tally to job margin.** Only Quickest claims a Tally link [S1], and none shows reconciliation to job cost.

**PRD gaps found, ranked by damage if missing.** Logged for a change request; the PRD is not edited.

| Rank | Gap | Damage | Note |
|---|---|---|---|
| 1 | Domain rule 2 ("subsidy is never a receivable") is wrong for ULA jobs [S43][S44] | Cash-blocked (F-16) and ageing (F-47) understate money owed to the EPC on ULA jobs | Needs a per-job "subsidy route" field; CR |
| 2 | No consumer-approval stage or "waiting on consumer" party | Jobs show as "our delay" when the customer has not clicked approve | Data in F-12; F-13 waiting-on list must include consumer |
| 3 | No scheme-compliance clocks (FQI defect, complaint response, 60-day hold) or deactivation risk | Deactivation blocks new sales for a month | Rules as data in F-18; widget in F-21 |
| 4 | Portal tasks that only the main vendor login can do ("not through the Vendor sub-login") [S33] | The task lands on a PM who cannot do it | F-03 role or label; F-23 assignment rule |
| 5 | ALMM List-II dates conflict: domain note says 1 June 2026 is in force; S&P reports cell procurement outside ALMM-II allowed until 31 December 2026 for net-metering and open-access projects [S41] | Wrong F-17 warnings | Verify the MNRE order, then fix data |

## 4. (d) Ranked opportunities

Effort: S under 1 week, M 1 to 3 weeks, L over 3 weeks, on top of the planned F-id. Ranked by owner money at risk times frequency (`INFERRED`).

| # | Opportunity | Problem | Evidence | F-id strengthened | Effort |
|---|---|---|---|---|---|
| 1 | **2026 scheme stage pack**: consumer-agreement approval, FQI defect with a 15-day clock, complaint response with a 15-day clock, a 60-day hold limit; "waiting on" includes consumer, DISCOM, REC/NPIA, bank, us | Jobs stall in states the tools do not name | [S31][S32][S33][S35] | F-12, F-13, F-15 (data only per F-12-AC3) | S |
| 2 | **Vendor-standing widget**: applications nearing day 60, open FQI defects with days left, complaints with days left, deactivation risk | Deactivation stops new applications for a month | [S30][S32][S33] | F-21, F-18 rules, F-20 ranking (impact = sales stop) | S |
| 3 | **Portal-ready evidence capture**: in-app camera stamps capture time and location (not upload time); a checklist per document type (panels, inverter serial, net meter, property, selfie); blur and wrong-page warning; defect-by-defect proof | Rejections and rework; evidence that a geo-tag cannot prove | [S33][S34][S50][S51] | F-14, F-50, F-49 | M |
| 4 | **Serial and DCR pre-check**: block a duplicate serial across the company before portal entry; require the 16-digit DCR certificate per module lot; double-entry for inverter serials | Portal refuses repeated serials with no undertaking route | [S37][S38][S55] | F-37 (AC2 extends to inverter), F-17 | S |
| 5 | **Rule-change margin exposure**: re-forecast the signed backlog when a dated cost rule or price-book change lands; list jobs below the floor | MP contractors lost money on tenders priced before the DCR rule | [S40][S42] | F-43, F-17, F-26 | M |
| 6 | **Subsidy route per job** (consumer-credited versus vendor-credited under ULA/RESCO); vendor-credited CFA counts as a receivable with its own stage chain | Rule 2 hides cash owed to the EPC on ULA jobs | [S43][S44] | F-16, F-47; **new: needs change request** (domain rule 2) | M |
| 7 | **Inspection-request lag**: installed jobs where inspection was not requested the same day, aged per DISCOM limit (e.g. MSEDCL: 10 working days to test and commission, then 10 to fit the net meter) | Every day before the request extends the queue | [S48][S49] | F-13, F-15, F-16 | S |
| 8 | **Low-end-phone site flow in Hindi, Marathi and Gujarati**: photo first, 3 taps per update, visible queue, works on an entry-level Android phone | Field apps get abandoned within weeks | [S26] | F-49, F-50, F-07-AC2 scripts | L |
| 9 | **Dated deadline register**: CFA claim deadline (30 November 2026 for legacy Phase II claims), sanction validity (6 months at MSEDCL), ALMM dates; countdown exceptions | Money lost at a hard date nobody watched | [S39][S49][S41] | F-12, F-14 (AC4 expiry), F-18 | S |
| 10 | **Tally reconcile to job margin**: unmatched-voucher queue shown beside job forecast margin | Books and job margin disagree, so owners keep a shadow sheet | [S1] (only claim found) | F-56, F-42 | M |
| 11 | Main-login-only portal tasks routed to the holder, with a reminder | The PM cannot act and the job ages | [S33] | F-03, F-23 | S |
| 12 | Customer nudge by WhatsApp utility template for "approve agreement on the portal" and "loan document pending" | Consumer waits are the slowest party | [S35][S52][S53] | F-57, F-64 (Later) | M |

## 5. (e) Owner-dashboard widgets and the decision each supports

| Widget | Shows | Decision it supports | F-id |
|---|---|---|---|
| Ranked exceptions (exists) | Top items by cash, margin and delay; rank also counts "blocks new sales" | What I chase first today | F-20 |
| Cash blocked by waiting party | Rupees by consumer, DISCOM, REC/CFA (ULA), lender, us; each opens its jobs | Whom to call: a customer, a DISCOM office or my own PM | F-16 |
| Vendor standing | Applications at day 45+ of 60, FQI defects and complaints with days left, last deactivation check | Do I pause new sign-ups or move a crew to fix defects | F-21 (new rule set) |
| Inspection queue | Installed jobs, days since install, inspection requested yes or no, days against the DISCOM limit | Send someone to the division office today | F-13 |
| Backlog against crew and DCR stock | Signed, uninstalled kW by age against crew days and compliant stock | Accept more orders or slow sales | F-26, F-39 |
| Backlog margin exposure | Jobs below the floor after re-costing, rupees at risk, cause (rule, price, freight) | Renegotiate, re-sequence or accept the loss | F-43 |
| Material shortfall by date | Uncovered quantity by required-by date with expedite, substitute and transfer actions | Approve an expedite or a substitution | F-39 |
| Collections today | Dues with promise date and blocked-by chain; subsidy excluded unless ULA | Call the customer or fix the stage first | F-47, F-48 |
| Approvals waiting on me | Count, oldest age, amount, 3 facts | Approve now on the phone | F-22, F-28 |
| Data trust strip | Jobs with no stage update in 7 days, missing portal reference, stale Tally sync | Whether to trust this screen; whom to chase for updates | F-21-AC2 |
| Rework rate | Document rejections and FQI defects by type, crew and supervisor over 30 days | Retrain a crew or change a checklist | F-14 log plus a metric (INFERRED, small) |

Design notes, all `INFERRED`:
- Every widget has a "days left" form, not only "days old", because the 2026 rules are countdowns.
- Owners think in lakh. Show rupees in the Indian grouping (12,50,000), never "1.25M".

## 6. (f) Real-life edge cases

| # | Situation | Expected outcome | Test type |
|---|---|---|---|
| 1 | Supervisor types a stage note in Hinglish ("net meter lag gaya, DISCOM wale kal aayenge") | Stored as typed; search finds "net meter"; no transliteration is forced | Unit (text search) |
| 2 | One phone shared by 3 crew members | Each update records the signed-in person; a quick user switch needs a PIN; drafts of user A are hidden from user B | E2E |
| 3 | Photo taken offline at 10:02, synced at 18:40 | Evidence shows capture time 10:02 and the capture location; upload time shown apart; no "geo-tagged" claim if the device had no location fix | Integration (offline) |
| 4 | Double tap on "Move to next stage" | 1 transition recorded; the second is refused as a duplicate (F-13-AC3) | Integration (concurrency) |
| 5 | Two tabs: PM edits the stage while the owner overrides a gate | 1 wins; the other sees a conflict with both values; nothing is overwritten silently | E2E |
| 6 | Consumer rejects the agreement with remarks | Stage returns to "agreement revision", waiting on us; remarks logged in evidence; the clock restarts | Unit (stage machine) |
| 7 | Contract value changed after the consumer approved the agreement | Baseline revision 2 is created and the job flags "consumer re-approval needed" [S35] | Integration |
| 8 | Inverter serial typed "O" for "0", or already used on another job | Refused before portal entry; the earlier job is shown | Unit |
| 9 | DCR certificate number not 16 digits, or a module lot without a certificate | Invoice warning (F-17); job cannot move to "upload installation" without an approver override | Unit |
| 10 | FQI defect assigned on a Friday before Diwali | Shows days left on the clock the rule uses (calendar or working: **verify**); escalates at day 10 to the PM and day 13 to the owner | Unit (calendar) |
| 11 | Task needs the main vendor login, but the assignee is a sub-login PM | Assignment rule routes it to the main-login holder; the PM sees "waiting on owner login" | Integration |
| 12 | Company deactivated on the portal for a month | Existing jobs continue; a new-application stage is blocked with the reason and reactivation date [S30] | Unit |
| 13 | ULA job: CFA paid to the vendor account | Counted as a receivable in its own column; vendor bank-detail change raises "re-verification pending" [S43] | Unit (money) |
| 14 | Consumer-led job: customer has paid 70% and waits for subsidy to pay the rest | 30% shows as "customer due after subsidy", not overdue; the reminder date follows the CFA stage | Unit (ageing) |
| 15 | Customer pays ₹20,000 cash to the site supervisor | Receipt captured with a photo of the signed slip; pending finance confirmation; never counted twice when finance enters it | Integration |
| 16 | Customer disputes a cracked module and withholds the final 10% | Disputed amount in its own column (F-47-AC2); linked to the defect and the claim (F-35) | Unit |
| 17 | Excel paste with "2,50,000", "2.5 L", "250000/-", "5kW" against "5000 W" | Each parses to integer paise or watts, or the row errors with a column message; "L" and "Cr" are understood | Unit (import) |
| 18 | Dates "04/11/26" from a sheet | Read as dd/mm/yy by tenant setting; ambiguous rows flagged | Unit |
| 19 | Old offline app queues an update to a stage renamed in a newer template | The update applies to the job's own template revision (F-12-AC2); no crash; the user sees "template updated" | Integration (versioning) |
| 20 | MSEDCL sanction near its 6-month validity [S49] | Expiry warning 30 days before and on the day (F-14-AC4) | Unit |
| 21 | Portal is down for days [S28] | PM marks "portal outage" as the blocker; the clock is held or noted by rule; the owner sees a cluster, not 40 separate exceptions (F-18-AC1 pattern) | Integration |
| 22 | Name on the electricity bill differs from the customer's ID | Checklist item "name match or affidavit"; no ID number stored (rule 9) | Unit (privacy) |
| 23 | Supervisor phone with 2 GB RAM and 2 GB free storage | The day's jobs load; photos are compressed before queueing; the queue survives an app kill | Device test |
| 24 | Monsoon week: 6 jobs blocked by weather | One exception with 6 jobs, cause "weather"; does not count against crew performance | Unit |

## 7. (g) What NOT to build

| Do not build | Why | Tag |
|---|---|---|
| PV design, shading or yield tools | Arka360, SurgePV, Aurora and OpenSolar (free) cover it; already X-01 | S [S10][S16] |
| Proposal PDFs with a PM Surya Ghar subsidy calculator or savings calculator | Commoditised: Quickest free tier, SurgePV, SolarOps360 free tools | S [S1][S3][S6] |
| Lead capture, IndiaMART or Meta ad connectors | Quickest lists them; X-04 | S [S1] |
| GPS attendance, payroll or geofencing | SolarOps360 and Powerplay have it; X-03 covers payroll | S [S6][S25] |
| Marketing WhatsApp broadcasts | Marketing messages cost about ₹0.86 each against about ₹0.115 for utility (rates vary by source); low value for operations | S [S52][S53] |
| Portal scraping or automation | No API; credential liability; X-05 | INFERRED |
| Working-capital lending inside the product | Solar Ladder and Powerplay offer credit; regulated and far from the wedge. Revisit as a partner referral only | S [S15][S25] |
| A native app before the web app proves adoption | X-06; the risk is adoption, not platform | INFERRED |
| A generic chat or AI assistant | Adds nothing to "what is stuck"; X-08 | INFERRED |

## 8. Unverified and conflicting items to resolve first

1. ALMM List-II for cells: "no extension beyond 1 June 2026" versus "until 31 December 2026 for net-metering and open access" [S41][S42]. Read the MNRE order.
2. Whether the FQI 15-day window counts calendar or working days, and when it starts [S33][S34].
3. ULA CFA paid to the vendor: the reports are from October 2025 [S43][S44]. Confirm it is current.
4. CFA claim deadline of 30 November 2026: scope is legacy Phase II applications at redeemed, inspected or installed stage [S39].
5. Prices for Quickest, SurgePV and Arka360 come from rival or third-party blogs; confirm on the vendors' own pricing pages.
6. Sunbase's "DISCOM document tracking" and Quickest's Tally link are claims only. A demo is needed.

## 9. Sources

All links were found by search on 2026-11-04. **None were opened** (WebFetch was blocked). All are UNKNOWN - REQUIRES VERIFICATION.

- [S1] [Quickest: solar CRM pricing guide](https://quickestimate.co/blog/solar-crm-pricing-guide); [Quickest CRM](https://quickestimate.co/crm)
- [S2] [Quickest: free solar software Hindi mein](https://quickestimate.co/blog/free-solar-software-hindi-mein)
- [S3] [SurgePV CRM](https://www.surgepv.com/crm)
- [S4] [SurgePV: solar CRM India vs global](https://www.surgepv.com/compare/solar-crm-india-vs-global)
- [S5] [Heaven Green: best solar software India 2026](https://www.heavengreenenergy.com/blog/best-solar-software-india)
- [S6] [SolarOps360 on Capterra India](https://www.capterra.in/software/1238725/SolarOps360); [Capterra UK](https://www.capterra.co.uk/software/1238725/SolarOps360)
- [S7] [Sunbase: best solar CRM for Indian EPCs 2026](https://www.sunbasedata.com/blog/best-solar-crm-for-indian-epcs-in-2026-features-that-actually-matter)
- [S8] [Sunbase: why India-based installers require different features](https://www.sunbasedata.com/blog/why-india-based-installers-require-different-features)
- [S9] [Arka360 Surya Ghar](https://arka360.com/in/suryaghar)
- [S10] [Heaven Green: Arka360 review 2026](https://www.heavengreenenergy.com/blog/arka360-review)
- [S11] [G2: ARKA 360 vs Aurora vs HelioScope](https://www.g2.com/compare/arka-360-vs-aurora-solar-vs-helioscope)
- [S12] [Heaven Green: Solar Ladder review 2026](https://www.heavengreenenergy.com/blog/solar-ladder-review)
- [S13] [G2: Solar Ladder pricing](https://www.g2.com/products/solar-ladder/pricing)
- [S14] [pv magazine India: Solar Ladder seed](https://www.pv-magazine-india.com/2023/05/04/solar-ladder-raises-inr-11-crore-in-seed-funding)
- [S15] [Mercom Capital: Solar Ladder seed](https://mercomcapital.com/supply-chain-platform-solar-ladder-raises-1-3-million-in-seed-funding/)
- [S16] [OpenSolar: why is OpenSolar free](https://www.opensolar.com/free/)
- [S17] [SurgePV: India solar design software comparison](https://www.surgepv.com/solar-compliance/india/comparisons/solar-design-software)
- [S18] [SurgePV: Aurora Solar review](https://www.surgepv.com/reviews/aurora-solar)
- [S19] [G2: Enerflo Platform reviews](https://www.g2.com/products/enerflo-platform/reviews)
- [S20] [Capterra: Scoop reviews](https://www.capterra.com/p/136648/Scoop-MAE-Enterprise-Software/reviews/)
- [S21] [Software Advice: Scoop Solar](https://www.softwareadvice.com/project-management/scoop-solar-profile/)
- [S22] [TrustRadius: Bigin review by an emerging solar EPC, India](https://www.trustradius.com/reviews/bigin-by-zoho-crm-2024-09-16-11-46-10)
- [S23] [Infomaze: customising Zoho CRM for solar installers](https://www.infomazeelite.com/customizing-zoho-crm-for-solar-installers-a-case-study/)
- [S24] [Udyog: ERP for solar and renewable energy](https://www.udyogsoftware.com/erp-for-solar-renewable-energy)
- [S25] [Techjockey: Powerplay](https://techjockey.com/detail/powerplay); [Construction World: Powerplay project-linked credit](https://www.constructionworld.in/amp/policy-updates-and-economic-news/powerplay-rolls-out-project-linked-credit-for-contractors/84332)
- [S26] [Site Smartly: Excel to app](https://site-smartly-website.pages.dev/blog-excel-to-app.html); [Houzzdat: construction apps vs ERP India](https://houzzdat.pages.dev/en/blog/construction-management-apps-vs-erp-india)
- [S27] [Mercom: issues plague PM Surya Ghar Yojana](https://mercomindia.com/issues-plague-pm-surya-ghar-yojana)
- [S28] [Mercom: bugs and glitches in national portal](https://mercomindia.com/bugs-glitches-national-portal)
- [S29] [Mercom: vendors complain of subsidy delays](https://mercomindia.com/rooftop-solar-vendors-complain-of-subsidy-delays)
- [S30] [SolarQuarter: MNRE deactivates 66 vendors (27 Aug 2026)](https://solarquarter.com/2026/08/27/mnre-deactivates-66-pm-surya-ghar-vendors-over-rooftop-solar-application-backlog/)
- [S31] [Energetica: clear applications within 60 days](https://www.energetica-india.net/news/mnre-advises-pm-surya-ghar-vendors-to-clear-applications-within-60-days)
- [S32] [SolarQuarter: SOP for complaints against vendors (25 Jun 2026)](https://solarquarter.com/2026/06/25/mnre-introduces-strict-sop-to-address-consumer-complaints-against-solar-vendors-under-pm-surya-ghar-scheme/)
- [S33] [SolarQuarter: 15-day defect rectification deadline (6 Oct 2026)](https://solarquarter.com/2026/10/06/mnre-sets-15-day-defect-rectification-deadline-for-pm-surya-ghar-vendors/)
- [S34] [Construction World: PM Surya Ghar tightens proof rules](https://www.constructionworld.in/energy-infrastructure/power-and-renewable-energy/pm-surya-ghar-tightens-proof-rules-for-solar-defect-rectification/98625)
- [S35] [Energetica: consumer approval of agreements mandatory](https://www.energetica-india.net/news/mnre-makes-consumer-approval-of-agreements-mandatory-on-pm-surya-ghar-portal)
- [S36] [Indian Infrastructure: consumer approval (24 Sep 2026)](https://indianinfrastructure.com/2026/09/24/mnre-mandates-consumer-approval-for-rooftop-solar-agreements/)
- [S37] [SolarQuarter: serial number verification rules (13 May 2026)](https://solarquarter.com/2026/05/13/mnre-tightens-serial-number-verification-rules-under-pm-surya-ghar-scheme/)
- [S38] [Energetica: DCR certificate number mandatory](https://www.energetica-india.net/news/mnre-mandates-entering-dcr-certificate-no-on-pm-surya-ghar-portal-to-address-duplication-issues)
- [S39] [Energetica: CFA claim deadline to 30 Nov 2026](https://www.energetica-india.net/news/mnre-extends-pm-surya-ghar-cfa-claim-deadline-to-november-30-2026)
- [S40] [Free Press Journal: MP 35% cost spike](https://www.freepressjournal.in/bhopal/solar-shock-in-mp-35-cost-spike-leaves-pm-surya-ghar-projects-in-limbo)
- [S41] [S&P Global: domestic cell mandate extension interview](https://www.spglobal.com/energy/en/news-research/latest-news/electric-power/073126-interview-domestic-solar-cell-mandate-extension-sufficient-to-address-project-construction-backlog)
- [S42] [Vision IAS: domestic cell mandate supply crunch (12 Jun 2026)](https://visionias.in/current-affairs/upsc-daily-news-summary/article/2026-06-12/the-indian-express/environment/domestic-cell-mandate-triggers-supply-crunch-may-hit-rooftop-solar-installation)
- [S43] [Mercom: CFA release rules for utility-led projects](https://mercomindia.com/mnre-notifies-cfa-release-rules-for-utility-led-pm-surya-ghar-projects)
- [S44] [Saur Energy: CFA disbursement linked to commissioning](https://www.saurenergy.com/solar-energy-news/mnre-links-cfa-disbursement-to-rooftop-solar-commissioning-10544249)
- [S45] [Mercom: installers in Punjab unhappy with rooftop price](https://www.mercomindia.com/installers-punjab-unhappy-rooftop-solar-price)
- [S46] [Tribune: Sirsa 16k applications, 580 installed](https://www.tribuneindia.com/news/haryana/16k-applications-in-sirsa-only-580-get-solar-panels-under-subsidy-scheme/amp)
- [S47] [Arab News (Reuters): rooftop push slowed by lenders, states](https://www.arabnews.com/world/modis-rooftop-solar-push-slowed-by-reluctant-lenders-states-2633151)
- [S48] [Mercom: MNRE asks DISCOMs to expedite commissioning](https://www.mercomindia.com/mnre-asks-discoms-to-expedite-commissioning-of-rooftop-solar-projects)
- [S49] [MSEDCL: Annexure 1, procedure for net metering](https://www.mahadiscom.in/consumer/wp-content/uploads/2020/01/Annexure-1.pdf)
- [S50] [Tata Power: PM Surya Ghar rejected, 13 reasons](https://www.tatapower.com/blogs/pm-surya-ghar-application-rejected-13-reasons-and-fixes)
- [S51] [Heaven Green: 12 PM Suryaghar rejection reasons](https://www.heavengreenenergy.com/blog/pm-suryaghar-rejection-reasons)
- [S52] [Meta: pricing on the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [S53] [AiSensy: per-message pricing update from 1 Jan 2026](https://news.aisensy.com/123053-whatsapp-per-message-pricing-update-effective-january-1-2026)
- [S54] [Down To Earth: 13% of PM Surya Ghar target met](https://www.downtoearth.org.in/energy/slow-surge-in-indias-rooftop-solar-push-just-13-of-pm-surya-ghar-target-met)
- [S55] [Mercom: module serial number glitch](https://mercomindia.com/module-serial-number-glitch-slowing-pm-surya-ghar-rooftop-solar-installations)
