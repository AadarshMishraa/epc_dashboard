# STATUS (updated 2026-11-04 by session 1)
Release target: first paid pilot (date TBD)   Current phase: P1 Demo and import (common must-haves)   Overall: GREEN

GREEN: the build starts on the common must-haves with default assumptions (decision 2026-11-05). Refinement with owners runs in parallel and changes data or scope through change requests. The pack waits only on the foundation tasks it uses.

States are a closed set: Not started, In progress, In review, Blocked, Done, Deferred. No percentages.
RAG: GREEN on date and unblocked; AMBER slip of 3 working days or less, or a blocker with an owner and a fix date; RED slip over 3 working days or blocked with no fix date.
Done for a feature means every acceptance criterion passes on staging ("N of N pass"). Done for a milestone needs evidence.

## Milestones
| ID | Outcome the client can verify | Features | Date | State | RAG | Evidence |
|----|-------------------------------|----------|------|-------|-----|----------|
| M-01 | A pitch demo opens on the owner home with sample data and shows exceptions, utility ageing, cash blocked and margin | F-05, F-01, F-02 | TBD | Not started | GREEN | - |
| M-02 | An owner brings a project sheet in, fixes every row error and sees baselined projects | F-04, F-08, F-09, F-10, F-11, F-03 | TBD | Not started | GREEN | - |
| M-03 | Every job carries its utility stage, owner, age, documents and evidence, and late stages escalate | F-12, F-13, F-14, F-15, F-16, F-54, F-23, F-25 | TBD | Not started | GREEN | - |
| M-04 | The owner opens one exceptions list and decides from it (pilot control loop) | F-18, F-19, F-20, F-21, F-22, F-24 | TBD | Not started | GREEN | - |
| M-05 | A pilot runs material from BOM to receipt to a readiness gate on a live job | F-29, F-30, F-31, F-32, F-33, F-34, F-37, F-38, F-39, F-40, F-07 | TBD | Not started | GREEN | - |
| M-06 | Forecast margin and receivables reconcile to source documents | F-42, F-43, F-46, F-47, F-55, F-06 | TBD | Not started | GREEN | - |
| M-07 | Field updates, Tally sync and collections work on live jobs | F-49, F-50, F-51, F-52, F-53, F-56, F-57, F-44, F-45, F-48, F-27, F-28, F-26, F-17, F-35, F-36, F-41 | TBD | Not started | GREEN | - |
| M-08 | Later features are promoted only when paying pilots ask for them twice | F-58, F-59, F-60, F-62, F-63, F-64, F-65, F-66, F-67, F-68, F-61 | TBD | Not started | GREEN | - |

## Features
| ID | Name | Priority | Milestone | State | Acceptance | Tests | PR |
|----|------|----------|-----------|-------|-----------|-------|----|
| F-01 | Pack workspace, boundary and money library | Must | M-01 | Not started | 0 of 5 pass | - | - |
| F-02 | Data classification and inventory for pack records | Must | M-01 | Not started | 0 of 3 pass | - | - |
| F-03 | Roles, scopes and approval policies | Must | M-02 | Not started | 0 of 4 pass | - | - |
| F-04 | Company setup and configuration bundle | Must | M-02 | Not started | 0 of 4 pass | - | - |
| F-05 | Demo and training tenant | Must | M-01 | Not started | 0 of 3 pass | - | - |
| F-06 | Erase, export and retention handlers | Must | M-06 | Not started | 0 of 4 pass | - | - |
| F-07 | Document generation | Must | M-05 | Not started | 0 of 4 pass | - | - |
| F-08 | Guided import from sheets | Must | M-02 | Not started | 0 of 4 pass | - | - |
| F-09 | Customer and site records | Must | M-02 | Not started | 0 of 4 pass | - | - |
| F-10 | Won-deal handoff and project baseline | Must | M-02 | Not started | 0 of 4 pass | - | - |
| F-11 | Project types and templates | Must | M-02 | Not started | 0 of 3 pass | - | - |
| F-12 | Utility and scheme stage templates | Must | M-03 | Not started | 0 of 4 pass | - | - |
| F-13 | Stage record and clock | Must | M-03 | Not started | 0 of 4 pass | - | - |
| F-14 | Stage document gates and evidence log | Must | M-03 | Not started | 0 of 4 pass | - | - |
| F-15 | Escalation rules | Must | M-03 | Not started | 0 of 4 pass | - | - |
| F-16 | Cash-blocked value | Must | M-03 | Not started | 0 of 4 pass | - | - |
| F-17 | DCR and ALMM flags | Should | M-07 | Not started | - | - | - |
| F-18 | Exception rules and evaluator | Must | M-04 | Not started | 0 of 5 pass | - | - |
| F-19 | Exception lifecycle | Must | M-04 | Not started | 0 of 3 pass | - | - |
| F-20 | Owner home: ranked exceptions and pulse strip | Must | M-04 | Not started | 0 of 4 pass | - | - |
| F-21 | Portfolio widgets, drill-down and freshness | Must | M-04 | Not started | 0 of 4 pass | - | - |
| F-22 | Approval queue | Must | M-04 | Not started | 0 of 4 pass | - | - |
| F-23 | Tasks and reminders | Must | M-03 | Not started | 0 of 3 pass | - | - |
| F-24 | Record timeline | Should | M-04 | Not started | - | - | - |
| F-25 | In-app notices | Should | M-03 | Not started | - | - | - |
| F-26 | Backlog against crew capacity | Should | M-07 | Not started | - | - | - |
| F-27 | Daily and weekly digest | Should | M-07 | Not started | - | - | - |
| F-28 | Owner mobile view | Should | M-07 | Not started | - | - | - |
| F-29 | Supplier master | Must | M-05 | Not started | 0 of 3 pass | - | - |
| F-30 | BOM lines and quantity states | Must | M-05 | Not started | 0 of 4 pass | - | - |
| F-31 | Request for quotation and supplier quote link | Must | M-05 | Not started | 0 of 4 pass | - | - |
| F-32 | Quote capture, comparison and landed cost | Must | M-05 | Not started | 0 of 4 pass | - | - |
| F-33 | Purchase orders and approvals | Must | M-05 | Not started | 0 of 4 pass | - | - |
| F-34 | Supplier promises and ETAs | Must | M-05 | Not started | 0 of 3 pass | - | - |
| F-35 | Returns and claims | Should | M-07 | Not started | - | - | - |
| F-36 | BOM revision impact and change requests | Should | M-07 | Not started | - | - | - |
| F-37 | Goods receipt, inspection and serials | Must | M-05 | Not started | 0 of 4 pass | - | - |
| F-38 | Stock ledger and reservations | Must | M-05 | Not started | 0 of 4 pass | - | - |
| F-39 | Material availability and shortage | Must | M-05 | Not started | 0 of 3 pass | - | - |
| F-40 | Readiness gate | Must | M-05 | Not started | 0 of 4 pass | - | - |
| F-41 | Transfers and issue to site | Should | M-07 | Not started | - | - | - |
| F-42 | Budget, commitments and actual cost | Must | M-06 | Not started | 0 of 4 pass | - | - |
| F-43 | Forecast margin and margin floor | Must | M-06 | Not started | 0 of 4 pass | - | - |
| F-44 | Supplier bills and duplicate guard | Should | M-07 | Not started | - | - | - |
| F-45 | Field expenses | Should | M-07 | Not started | - | - | - |
| F-46 | Milestone billing plan and invoice records | Must | M-06 | Not started | 0 of 4 pass | - | - |
| F-47 | Receipts, ageing and the blocked-by chain | Must | M-06 | Not started | 0 of 4 pass | - | - |
| F-48 | Collections board and reminders | Should | M-07 | Not started | - | - | - |
| F-49 | Site app: installable, offline and conflict-safe | Should | M-07 | Not started | - | - | - |
| F-50 | Site daily plan, checklist, photos and blockers | Should | M-07 | Not started | - | - | - |
| F-51 | Crew and subcontractor calendar | Should | M-07 | Not started | - | - | - |
| F-52 | Quality checks and punch list | Should | M-07 | Not started | - | - | - |
| F-53 | Commissioning and handover pack | Should | M-07 | Not started | - | - | - |
| F-54 | Email sending | Must | M-03 | Not started | 0 of 3 pass | - | - |
| F-55 | Export everything | Must | M-06 | Not started | 0 of 4 pass | - | - |
| F-56 | Tally sync | Should | M-07 | Not started | - | - | - |
| F-57 | WhatsApp messaging | Should | M-07 | Not started | - | - | - |
| F-58 | Site survey capture | Later | M-08 | Not started | - | - | - |
| F-59 | Estimate and price book | Later | M-08 | Not started | - | - | - |
| F-60 | Proposal versions | Later | M-08 | Not started | - | - | - |
| F-61 | Leads and channels | Later | M-08 | Not started | - | - | - |
| F-62 | Installed asset register | Later | M-08 | Not started | - | - | - |
| F-63 | Service tickets and AMC | Later | M-08 | Not started | - | - | - |
| F-64 | Customer tracking link and portal | Later | M-08 | Not started | - | - | - |
| F-65 | Dealer accounts and credit (Trade pack) | Later | M-08 | Not started | - | - | - |
| F-66 | GST invoice issuing and payment links | Later | M-08 | Not started | - | - | - |
| F-67 | API and webhooks | Later | M-08 | Not started | - | - | - |
| F-68 | AI extraction | Later | M-08 | Not started | - | - | - |

## Tasks (current milestone only)
| ID | Feature | Task | State | Blocked by |
|----|---------|------|-------|-----------|
| T-001 | F-01 | E0-T01 Pack workspace, manifest and boundary checks | Not started | - |
| T-002 | F-01 | E0-T02 Money, quantity and tax library | Not started | T-001 |
| T-003 | F-01 | E0-T03 Working calendar and clock rules | Not started | T-001 |
| T-004 | F-02 | E0-T04 Data classification and inventory for pack entities | Not started | T-001 |
| T-009 | F-05 | E0-T09 Demo tenant seed | Not started | T-002, T-003 |
| T-010 | F-05 | E0-T10 Pitch demo of the owner views | Not started | T-009 |

## Decisions needed from the client
| ID | Decision | Needed by | Impact if late |
|----|----------|-----------|----------------|
| D-01 | Which one or two states and utilities do we configure first, and who confirms their stage lists? | at refinement | Stage templates cannot be written |
| D-02 | Who is the design partner owner and which 3 to 5 companies are the pilots? | at refinement | Definitions cannot be agreed |
| D-03 | Do we issue GST invoices in the pack, or record and sync invoices from Tally? | before E7-T02 | Invoice records design blocked |
| D-04 | Do pilot companies hold warehouse stock, or buy project by project straight to site? | before E5-T04 | Stock model unproven |
| D-05 | What may the site app keep on the phone while offline? | before E8-T01 | No offline site app |
| D-06 | What is the pilot offer: price, length and what the owner gives in return? | before the first pilot | First pilot offer unset |
| D-07 | How are the pack and its modules packaged into plans and limits? | before foundation K3 tasks are used by the pack | Plan limits unset |
| D-08 | Which accounting tool beyond Tally do the first 10 targets use? | before E9-T03 | Tally scope unclear |
| D-09 | Which WhatsApp business provider, and who bears the per-message cost? | before E9-T06 | WhatsApp blocked |
| D-12 | Which foundation order lets a pilot start earliest? | before foundation wave 4 | Pilot start slips |
