---
project: EPC pack on the GX foundation
client: GarunaCDX
version: 0.1-draft
status: draft
owner: Aadarsh Mishra
approvers: [Aadarsh Mishra]
---

# 1. Objective
Problem (3 sentences max): Indian solar EPC owners run jobs on Excel, WhatsApp and Tally, so they learn too late which jobs are stuck at the utility, which material is missing and which jobs lose margin. Cash sits blocked after installation while approvals age unseen. The pack gives the owner one ranked list of what is stuck, why, who owns it and what it costs.
Why now: Rooftop installations are at record levels but the subsidy window is ending and the domestic-cell rule raises execution risk, so mid-size and commercial EPCs need control after the sale more than another CRM. The foundation decisions (ADR-0001 to ADR-0006) are accepted, so the pack can be planned in step with the foundation waves.

| ID | Goal | Metric | Baseline | Target | By when |
|----|------|--------|----------|--------|---------|
| G-01 | The EPC pack runs on foundation public APIs only, so a later vertical can cherry-pick the foundation | Foundation files edited for the pack plus industry words found in foundation packages | no pack exists | 0 edits and 0 words | every merge; extraction drill at the end of foundation wave 5 |
| G-02 | An owner sees what is stuck, why, who owns it and what it costs without calling anyone | Seconds for a cold owner on sample data to name the 3 most urgent items | not measured (sheets and calls take minutes) | 30 seconds or fewer for 5 of 5 owners | pilot gate G2 |
| G-03 | Pilot owners stop keeping a parallel spreadsheet for the covered workflow | Pilot companies with no shadow spreadsheet for utility stages, material and margin | 0 of 3 | 3 of 3 pilots | pilot gate G3 |
| G-04 | Utility-stage data is trustworthy enough to act on | Pilot jobs whose recorded stage matches the portal reference at a weekly spot check | not measured | 95% or more of sampled jobs across 4 weekly checks | pilot gate G2 |
| G-05 | Forecast margin predicts real margin | Closed pilot jobs whose forecast margin at the commissioning milestone is within 5 percentage points of realised margin | not measured | 80% or more of closed jobs | pilot gate G4 |
| G-06 | Pilots become paying customers | Pilot companies that sign a paid plan after the paid trial | 0 of 0 | 3 or more | pilot gate G4 |
| G-07 | Customer data handling meets DPDP duties from the first pilot | Seeded access, correction and erasure requests completed inside the configured limit, and open Critical or High security findings | no desk exists | 10 of 10 requests and 0 findings | before the first pilot uses real customer data |

# 2. Users
| ID | Role | Who they are | Device / language / tech comfort | How they do it today | Biggest pain | Primary? |
|----|------|--------------|----------------------------------|----------------------|--------------|----------|
| U-01 | Owner or admin | Owner of an Indian solar EPC or installer with 10 to 40 live projects and 15 to 100 staff | laptop and phone, Hindi and English, medium | Excel, WhatsApp groups, Tally and phone calls | cannot see what is stuck, what it costs or where margin leaks | yes |
| U-02 | Project manager | Plans jobs, chases utility approvals and keeps customers informed | laptop and phone, Hindi and English, medium | sheets and chat groups | approvals stall unseen and documents are repeated | no |
| U-03 | Procurement | Buys material, compares quotes and chases suppliers | laptop and phone, Hindi and English, medium | WhatsApp quotes and a purchase sheet | quotes are not comparable and delivery dates slip silently | no |
| U-04 | Store or receiving | Receives goods, inspects, records serials and issues to site | phone and laptop, Hindi and English, low to medium | paper challans and a stock sheet | stock on paper differs from stock on the shelf | no |
| U-05 | Site supervisor | Leads crews on site and reports progress and blockers | phone first, Hindi, Marathi or Gujarati, low | calls and photos on chat | arrives without material or permits and cannot report in a few steps | no |
| U-06 | Finance or accounts | Records invoices, receipts, supplier bills and keeps books in Tally | laptop, English, medium | Tally plus a dues sheet | cannot see profit per job or which dues wait on a utility stage | no |
| U-07 | Sales or surveyor | Surveys sites, estimates and hands won deals to operations | phone and laptop, Hindi and English, medium | a CRM or sheets | won-deal data is retyped at handoff | no |
| U-08 | Service coordinator | Handles warranty, AMC and service visits after handover | phone and laptop, Hindi and English, medium | a diary and calls | warranty and AMC dates are not tied to the install record | no |

Buyer / payer: the EPC owner pays a monthly subscription per company (hypothesis: 5,000 rupees including a defined user and project allowance; decision Q-06).

# 3. Needs
| ID | As (U-xx) I need | so that | Serves | Priority |
|----|------------------|---------|--------|----------|
| N-01 | As U-01 I need one list of exceptions, ranked by cash blocked, margin at risk and days of delay, each with a reason, an owner and a next action | I decide from one view without calling five people | G-02 | Must |
| N-02 | As U-01 I need every figure to open the records behind it and show how fresh it is | I trust the numbers enough to act on them | G-02, G-05 | Must |
| N-03 | As U-01 I need to see the contract value of jobs installed but not energised or not yet claimed, grouped by blocker | I know why cash is stuck | G-02, G-04 | Must |
| N-04 | As U-01 I need to approve purchase orders, change requests and expenses with the context shown beside the request | decisions are made within one working day and stay traceable | G-02 | Must |
| N-05 | As U-02 I need each job to carry its utility and subsidy stage, who owes the next step, its age and the documents required | no approval stalls unseen | G-03, G-04 | Must |
| N-06 | As U-02 I need reminders and escalation when a stage ages past its limit | delays reach the owner before they cost money | G-04 | Must |
| N-07 | As U-02 I need to bring my existing project sheets in without retyping and see every row error | switching costs hours, not weeks | G-03 | Must |
| N-08 | As U-03 I need to request quotes for BOM lines from several suppliers, compare them on landed cost and raise an approved purchase order | I buy the right material at the right price once | G-03, G-05 | Must |
| N-09 | As U-03 I need to record each supplier's promised dates and every change | late material is known before the crew is booked | G-03 | Must |
| N-10 | As U-04 I need to receive goods against purchase orders, inspect them and record serial numbers | only accepted material counts as stock | G-03 | Must |
| N-11 | As U-02 I need to know before a crew leaves whether material, permits and access are ready | crews do not travel to blocked sites | G-03, G-05 | Must |
| N-12 | As U-06 I need budget, commitments and actual cost kept distinct per job and a forecast margin from them | I see a margin leak while the job is open | G-05 | Must |
| N-13 | As U-06 I need milestone invoices, receipts, retention and disputes tracked with ageing, and subsidy kept separate from customer dues | collections are chased on the right people | G-02, G-03 | Must |
| N-14 | As U-05 I need a daily plan, checklist, photos and blocker reports that work with weak signal | site updates reach the office the same day | G-03 | Should |
| N-15 | As U-06 I need records to flow to and from Tally without double entry | books and operations agree | G-03 | Should |
| N-16 | As U-01 I need customer data protected, exportable and erasable on request, with my data in an Indian region | I meet my privacy duties and can leave with my data | G-07 | Must |
| N-17 | As U-01 I need roles and approval limits that separate who requests, approves and pays | no single person can commit or pay alone above a threshold | G-01, G-07 | Must |
| N-18 | As U-07 I need a won deal to become a project with its customer and site data intact | handoff does not lose or retype anything | G-03 | Must |
| N-19 | As U-08 I need warranty and AMC tied to the serials installed at each site | service starts from the install record | G-06 | Later |
| N-20 | As U-01 I need a weekly summary of what moved, what is stuck and what to fix | I run a review without building one by hand | G-02 | Should |
| N-21 | As U-01 I need the pack to run on an isolated, audited foundation that keeps my company's data apart from every other company | my data is never visible to another firm and every change has a record | G-01, G-07 | Must |

# 4. Features
| ID | Feature | One line | Serves | Priority | Depends on |
|----|---------|----------|--------|----------|------------|
| F-01 | Pack workspace, boundary and money library | Create the pack workspace and manifest, enforce the boundary to the foundation, and provide integer-paise money, units, tax rates as data and a working calendar. | N-21 | Must | - |
| F-02 | Data classification and inventory for pack records | Classify every pack field, keep the data inventory current and block fields without a class. | N-16, N-21 | Must | F-01 |
| F-03 | Roles, scopes and approval policies | Declare the pack's permissions and default roles, scope them by project and branch, and separate who requests, approves and pays above a threshold. | N-17, N-21 | Must | F-01, F-04 |
| F-04 | Company setup and configuration bundle | Set up branches, warehouses, project types, calendar, GST details, thresholds and labels as data, applied from one bundle. | N-07, N-21 | Must | F-01 |
| F-05 | Demo and training tenant | A deterministic tenant of synthetic projects, suppliers, stock and utility stages, and a read-only demo of the owner views. | N-01, N-21 | Must | F-01 |
| F-06 | Erase, export and retention handlers | Register erase and export handlers for every pack module that holds personal data and keep statutory records when erasing. | N-16 | Must | F-02 |
| F-07 | Document generation | Render purchase orders, handover packs and statements as PDFs from templates, in the tenant's languages, with private short-lived access. | N-08, N-21 | Must | F-33 |
| F-08 | Guided import from sheets | Bring projects, BOMs, suppliers, stock and customers in from CSV and Excel with column mapping, row-level errors and safe re-import. | N-07 | Must | F-01 |
| F-09 | Customer and site records | Customers, sites, contacts and consent in one record, with duplicate detection that never merges silently. | N-18, N-16 | Must | F-02 |
| F-10 | Won-deal handoff and project baseline | Create a project from a sheet row, a CRM export or manual entry, then freeze scope, contract value, budget and milestones as revision 1. | N-18, N-12 | Must | F-08, F-09 |
| F-11 | Project types and templates | Milestones, tasks, dependencies and required evidence for residential, commercial and 100 kW and above projects. | N-05 | Must | F-04, F-10 |
| F-12 | Utility and scheme stage templates | Stage lists with limits per state, utility, scheme and project type, kept as editable data and shipped for the first two states. | N-05 | Must | F-01, F-10 |
| F-13 | Stage record and clock | Per job: current stage, owner, who the job waits on, date entered, age against the limit and the next action. | N-05, N-06 | Must | F-12 |
| F-14 | Stage document gates and evidence log | A required-document checklist per stage, an override that needs an approver and reason, and an evidence log of references, screenshots and call notes. | N-05 | Must | F-13 |
| F-15 | Escalation rules | Reminders and tasks when a stage ages past its limit, escalating to the project manager and then to the owner. | N-06 | Must | F-13, F-23 |
| F-16 | Cash-blocked value | The contract value of jobs installed but not energised or not yet claimed, grouped by blocker. | N-03 | Must | F-10, F-13 |
| F-17 | DCR and ALMM flags | Mark BOM lines and serials as domestic-content or ALMM-compliant and warn before invoicing when data is missing. | N-05, N-11 | Should | F-30, F-37 |
| F-18 | Exception rules and evaluator | Exception rules as data (condition, threshold, owner, message) evaluated on events and nightly, with one exception per cause. | N-01 | Must | F-04 |
| F-19 | Exception lifecycle | Detected, assigned, acknowledged, action planned, resolved and verified, with reopen needing a reason and time to resolve measured. | N-01 | Must | F-18 |
| F-20 | Owner home: ranked exceptions and pulse strip | The home view lists open exceptions ranked by impact with reason, owner and next action, above five pulse numbers. | N-01 | Must | F-18, F-21 |
| F-21 | Portfolio widgets, drill-down and freshness | Projects at risk, material shortfalls, supplier delay risk, utility ageing, margin variance, receivables ageing and approvals, each opening its source records. | N-01, N-02 | Must | F-16, F-18 |
| F-22 | Approval queue | One queue for purchase orders, change requests, expenses and readiness overrides, with the context shown beside each request. | N-04, N-17 | Must | F-03, F-19 |
| F-23 | Tasks and reminders | One task model across records: assign, due date, reminders and a link to the record. | N-06 | Must | F-10, F-54 |
| F-24 | Record timeline | One history per project, customer and supplier showing messages, documents, photos, stage moves, approvals and money in time order. | N-02 | Should | F-10 |
| F-25 | In-app notices | A notification list and unread count for tasks, approvals and exceptions assigned to the person. | N-06 | Should | F-23 |
| F-26 | Backlog against crew capacity | Signed but uninstalled jobs by age against crew capacity, warning before the 60-day line. | N-01 | Should | F-21 |
| F-27 | Daily and weekly digest | A summary to the owner by email of top exceptions, cash blocked and margin movers. | N-20 | Should | F-21, F-54 |
| F-28 | Owner mobile view | Exceptions, approvals and cash blocked first on a phone. | N-01, N-04 | Should | F-20 |
| F-29 | Supplier master | Suppliers with categories, GST details, payment terms, credit limit, service area and delivery and quality history. | N-08 | Must | F-02 |
| F-30 | BOM lines and quantity states | Item, spec, unit, quantity, wastage, alternatives and required-by date per line, with planned, ordered, received, reserved, issued, installed and returned quantities kept consistent. | N-08, N-11 | Must | F-10 |
| F-31 | Request for quotation and supplier quote link | Request quotes for selected BOM lines from several suppliers by email or a private link and track responses and validity. | N-08 | Must | F-29, F-30, F-54 |
| F-32 | Quote capture, comparison and landed cost | Enter supplier quotes against the request and compare them side by side on price, GST, freight, delivery, warranty and terms. | N-08 | Must | F-31 |
| F-33 | Purchase orders and approvals | Raise a purchase order from the chosen quote, with duplicate guards and approval by threshold. | N-08, N-04 | Must | F-01, F-03, F-32 |
| F-34 | Supplier promises and ETAs | Record the acknowledgement, promised dispatch and delivery dates and every change with its effect on dependent jobs. | N-09 | Must | F-33 |
| F-35 | Returns and claims | Damaged, short and warranty claims with credit notes and open-claim tracking. | N-08 | Should | F-37 |
| F-36 | BOM revision impact and change requests | Compare old and new BOM, list affected orders and reservations before applying, and approve changes with cost and schedule effect. | N-08, N-04 | Should | F-22, F-30, F-33 |
| F-37 | Goods receipt, inspection and serials | Receive against purchase order lines with partial, over and under delivery, inspect and reject with photos, and capture serial and batch numbers. | N-10 | Must | F-33 |
| F-38 | Stock ledger and reservations | An append-only stock ledger by item, warehouse, site and status, and reservations to a project that warn on double promises. | N-10, N-11 | Must | F-37 |
| F-39 | Material availability and shortage | Per project and required-by date: stock, reserved, open orders with confirmed dates and the uncovered shortfall. | N-11 | Must | F-34, F-38 |
| F-40 | Readiness gate | Ready, conditional or blocked, with reasons for material, design, permit, access, crew and customer, shown before a crew is dispatched. | N-11 | Must | F-13, F-39 |
| F-41 | Transfers and issue to site | Move stock between warehouses and sites, issue to a crew and record consumption and returns. | N-10 | Should | F-38 |
| F-42 | Budget, commitments and actual cost | Budget by category from the baseline, with purchase orders as commitments and bills and expenses as actual cost, never counted twice. | N-12 | Must | F-10, F-33 |
| F-43 | Forecast margin and margin floor | Contract value less forecast final cost, the variance from baseline with its drivers, and a margin floor that raises exceptions. | N-12, N-02 | Must | F-18, F-42 |
| F-44 | Supplier bills and duplicate guard | Supplier bills, due dates, payment approval and a guard that flags probable duplicates. | N-12, N-15 | Should | F-42 |
| F-45 | Field expenses | Labour, transport, crane and other costs captured from the phone with a receipt photo. | N-12, N-14 | Should | F-42, F-50 |
| F-46 | Milestone billing plan and invoice records | A billing plan from the baseline milestones and records of invoices entered or imported with their Tally reference, kept unchangeable. | N-13 | Must | F-01, F-10 |
| F-47 | Receipts, ageing and the blocked-by chain | Receipts by cash, cheque and bank transfer, retention and disputed amounts apart, ageing by band, and the chain from a late invoice to the utility stage behind it. | N-13, N-03 | Must | F-16, F-46 |
| F-48 | Collections board and reminders | Overdue by age, promise-to-pay date, who calls whom today, and reminders on due dates. | N-13 | Should | F-47, F-54 |
| F-49 | Site app: installable, offline and conflict-safe | An installable web app for site work that queues updates offline, shows queued and synced state and never overwrites a conflict silently. | N-14 | Should | - |
| F-50 | Site daily plan, checklist, photos and blockers | Today's jobs, geo check-in, checklist, photos, installed quantities, blockers and material requests. | N-14 | Should | F-40, F-49 |
| F-51 | Crew and subcontractor calendar | Crews by day with clash and unready-site warnings, and subcontractor scope and completion approval. | N-14 | Should | F-40 |
| F-52 | Quality checks and punch list | Quality checks, rework tasks and serial scan at install. | N-14 | Should | F-50 |
| F-53 | Commissioning and handover pack | Test records, as-built documents, customer acceptance, warranty start and a handover pack built from current documents. | N-14, N-19 | Should | F-07, F-37, F-52 |
| F-54 | Email sending | Send requests, orders and reminders by email through a provider behind the message-sender port, with templates. | N-08, N-06 | Must | - |
| F-55 | Export everything | Export every record, attachment and history in documented CSV and JSON at any time, as an audited job. | N-16 | Must | F-06 |
| F-56 | Tally sync | Export vouchers and bills, import ledger and payment status, queue unmatched records and show last sync time and errors. | N-15 | Should | F-44, F-46 |
| F-57 | WhatsApp messaging | Supplier, crew and customer messages through a business provider with per-contact opt-in and approved templates. | N-06, N-09 | Should | F-54 |
| F-58 | Site survey capture | Configurable survey form with photos and location, offline. | N-18 | Later | - |
| F-59 | Estimate and price book | Versioned price book, margin rules and subsidy slabs that block quotes below the margin floor. | N-18 | Later | - |
| F-60 | Proposal versions | Branded proposals where acceptance records the exact revision. | N-18 | Later | - |
| F-61 | Leads and channels | Capture, duplicate catch, response timer and pipeline for enquiries. | N-18 | Later | - |
| F-62 | Installed asset register | Serials, commissioning data and warranty dates per site. | N-19 | Later | - |
| F-63 | Service tickets and AMC | Tickets with warranty check and SLA, visits, parts and AMC renewals. | N-19 | Later | - |
| F-64 | Customer tracking link and portal | A private link showing project stage, documents and dues. | N-18 | Later | - |
| F-65 | Dealer accounts and credit (Trade pack) | Partner accounts, price lists, credit checks and dispatch for selling to other installers. | N-08 | Later | - |
| F-66 | GST invoice issuing and payment links | Issue tax invoices and collect through hosted payment links, subject to decision Q-03. | N-13 | Later | - |
| F-67 | API and webhooks | Documented events and safe retries for projects, orders, receipts and stage changes. | N-15 | Later | - |
| F-68 | AI extraction | Read quotes, bills and challans into suggestions that a person confirms. | N-08 | Later | - |

Acceptance criteria (at least 3 per Must feature, Given / When / Then, with a number in the result):
F-01-AC1 Given the pack workspace When the boundary lint runs against the foundation Then 0 foundation files are edited and 0 industry words are found in foundation packages
F-01-AC2 Given a pack manifest with an undeclared permission used in code When the manifest check runs Then it exits with code 1 and names the permission
F-01-AC3 Given 10,000 generated documents with random lines, quantities and rates When totals are computed Then the sum of line amounts equals the document total in 10,000 of 10,000 cases and no float is used
F-01-AC4 Given a GST rate change dated 22 September 2025 When an amount is priced on 21 and 22 September Then the first uses the old rate and the second the new rate, 2 of 2 correct
F-01-AC5 Given a state holiday list and a stage entered on a Friday When the age in working days is read on the next Tuesday Then it shows 2 working days with the holiday excluded

F-02-AC1 Given a pack entity with a field that has no classification When the privacy check runs Then it exits with code 1 and names the field
F-02-AC2 Given the data inventory When the check compares it with the manifest Then 0 manifest fields are missing from the inventory
F-02-AC3 Given a customer phone number, an email and a site address When they appear in a log line or an audit diff Then all 3 values are masked in 3 of 3 outputs

F-03-AC1 Given 8 default roles and 40 declared pack actions When a user in each role tries every action Then each role is denied every action it does not hold, 0 unexpected allows
F-03-AC2 Given a purchase order above the approval threshold created by user A When user A tries to approve it Then the approval is refused with a reason code and the audit shows 1 denied attempt
F-03-AC3 Given a project manager scoped to branch Pune When they open a project in branch Nagpur Then the response is not found and 0 fields leak
F-03-AC4 Given the last owner of a company When their role is removed Then the change is refused, 1 owner remains and the audit holds 1 denied entry

F-04-AC1 Given an empty company When the EPC bundle is applied Then 3 project types, 2 state stage templates, the label set and 8 thresholds exist
F-04-AC2 Given the same bundle When it is applied a second time Then 0 records change
F-04-AC3 Given a GSTIN with a wrong check character When company setup is saved Then it is rejected with a field message and 0 records are written
F-04-AC4 Given a margin floor changed from 12% to 15% When the next evaluation runs Then the new value applies and the change appears in the audit with old and new value

F-05-AC1 Given the seed command When it runs twice on an empty database Then the same 25 projects, 10 suppliers and 40 stock lines exist both times and 0 real personal values are present
F-05-AC2 Given a cold viewer on the demo home When they are asked to name the 3 most urgent items Then 5 of 5 test viewers answer in 30 seconds or less
F-05-AC3 Given the demo in light and dark themes When the contrast and colour-budget gates run Then 0 contrast failures and at most 20% orange

F-06-AC1 Given a seeded customer with 3 projects, 2 photos and a receipt When an erasure request is run Then personal fields are removed or anonymised in 100% of handlers and the invoice and receipt records are kept with the reason recorded
F-06-AC2 Given the same customer When an export request is run Then one machine-readable file lists every record and attachment for that customer, and its checksum verifies
F-06-AC3 Given a retention schedule of 6 years for invoice records and 1 year for access logs When a record passes its period Then the retention job removes or anonymises it and writes 1 deletion record
F-06-AC4 Given 10 seeded requests When the request drill runs Then 10 of 10 complete inside the configured limit

F-07-AC1 Given a purchase order of 12 lines When its PDF is generated Then 1 PDF lists 12 lines and the totals equal the order total to the paise
F-07-AC2 Given a template with Hindi, Marathi and Gujarati labels When a PDF is rendered Then 0 missing glyphs across 3 of 3 scripts
F-07-AC3 Given a generated PDF link When it is opened after 5 minutes or by another company Then access is refused in 2 of 2 cases
F-07-AC4 Given a template change When an existing order is regenerated Then the stored original keeps its content and the new file is version 2 and version 1 is unchanged

F-08-AC1 Given a sheet of 5,000 rows with 3 bad rows When the dry run completes Then it finishes in 60 seconds or less, lists exactly 3 row errors with row and column, and writes 0 records
F-08-AC2 Given the corrected sheet When it is imported twice Then the second run creates 0 new records and updates 0
F-08-AC3 Given a cell that starts with = or @ and a file with a macro When they are imported Then the cell is stored as text with the prefix neutralised and the macro file is rejected, 2 of 2
F-08-AC4 Given a file of 60 MB When it is uploaded Then it is refused with a size message before parsing

F-09-AC1 Given two customers with the same phone number in 2 formats When the duplicate check runs Then both are listed as 1 candidate pair and 0 records are merged
F-09-AC2 Given a merge confirmed by a user When it completes Then projects and history of both move to 1 record and the audit holds 1 merge entry with both ids
F-09-AC3 Given a new customer from import When it is saved Then the notice version and consent state are stored in 2 of 2 fields, or the row is flagged as missing consent and counted in the error report
F-09-AC4 Given a user from another company When they search for the customer's phone number Then 0 results are returned

F-10-AC1 Given a won deal in a sheet row When the handoff runs Then 1 project exists with customer, site and contract value and a list of missing fields is shown
F-10-AC2 Given a project with a baseline When scope is changed after baseline Then revision 2 is created, revision 1 stays unchanged and the audit holds the reason
F-10-AC3 Given a baseline with budget lines When its total is compared with the contract value Then the difference is shown as planned margin in rupees and as a percentage with 2 decimals
F-10-AC4 Given a handoff row with no contract value When it is imported Then it is flagged and no baseline is created

F-11-AC1 Given the 3 project types When a project is created for each Then each gets its own milestone list, with 8 or more milestones and the required evidence per milestone
F-11-AC2 Given a template edited by the owner When a new project is created Then the new project uses the edited template and the 12 existing projects stay unchanged
F-11-AC3 Given a dependency from installation to material receipt When installation is scheduled before receipt Then the plan shows 1 dependency warning

F-12-AC1 Given the template for state A When it is applied to a new job Then the job carries every stage with its limit in working days, 100% of the template's stages
F-12-AC2 Given an owner who renames a stage and changes its limit from 15 to 20 days When the change is saved Then only new jobs use it, existing jobs keep their stages, and the audit holds 1 entry
F-12-AC3 Given a stage list for state B When it is added by configuration alone Then 0 code files change
F-12-AC4 Given a published template When a draft with a missing exit stage is published Then the publish is refused, 1 message names the stage and 0 jobs change

F-13-AC1 Given a job moved into a query stage waiting on the utility When the record is saved Then owner, waiting-on party, entry date and next action are all required and 4 of 4 are stored
F-13-AC2 Given a stage with a 10 working-day limit entered on a Monday When the age is read 11 working days later Then the job shows 1 day over the limit
F-13-AC3 Given 2 transitions submitted at the same moment When both are applied Then 1 succeeds, 1 is refused as a conflict and the history shows 1 move
F-13-AC4 Given a job past its limit When the owner opens the job Then the reason and the blocked-by chain show on the first view with 0 extra steps

F-14-AC1 Given a stage that needs 6 documents and 5 are present When the job is moved to the next stage Then the move is blocked and the 1 missing document is named
F-14-AC2 Given a user without approval rights When they override a gate Then the override is refused; an approver override stores reason, approver and time, 3 of 3 fields
F-14-AC3 Given a portal reference number, a screenshot and a call note When they are added to the evidence log Then 3 entries exist and none can be edited or deleted afterwards
F-14-AC4 Given an expired document When its stage is opened Then the expiry is flagged 30 days before and on the day

F-15-AC1 Given a stage with a limit of 10 working days When it reaches day 11 Then 1 task is assigned to the project manager and 0 duplicates are created on later runs
F-15-AC2 Given the same stage 5 working days later with no action When the escalation runs Then the owner receives 1 exception and the project manager is named
F-15-AC3 Given the stage is completed When the next run happens Then open reminders and tasks for it are closed, 0 remain open
F-15-AC4 Given the escalation job fails midway and is retried When it completes Then each notification is sent exactly once

F-16-AC1 Given 12 jobs installed and 5 not yet energised When the figure is calculated Then it equals the sum of those 5 contract values to the paise
F-16-AC2 Given jobs grouped by blocker When the owner opens a group Then each job in it is listed with its stage, age and owner
F-16-AC3 Given a job that is energised today When the figure is read Then it leaves the group in 1 refresh cycle of 5 minutes or less
F-16-AC4 Given subsidy waiting in the consumer's account When cash blocked is read Then subsidy adds 0 rupees to the company's receivables

F-18-AC1 Given one late delivery that affects 6 jobs When the evaluator runs Then 1 exception is raised and lists the 6 jobs
F-18-AC2 Given the same condition still true on the next run When the evaluator runs again Then 0 new exceptions are created and the existing one keeps its age
F-18-AC3 Given a rule edited by the owner from 7 to 5 days When the next run happens Then the new threshold applies and the audit holds 1 entry
F-18-AC4 Given a hostile expression in a rule When the rule is saved Then it is rejected and 0 rules change
F-18-AC5 Given the nightly run for 40 live projects When it completes Then it takes 30 seconds or less and runs once per company per night

F-19-AC1 Given a new exception When it moves through the 6 states Then each move records actor and time and out-of-order moves are refused
F-19-AC2 Given a resolved exception When it is reopened Then a reason is required and the reopen count rises by 1
F-19-AC3 Given 10 exceptions resolved in a week When the metric is read Then median time from detection to verified closure is shown by category

F-20-AC1 Given 12 open exceptions with different impacts When the home opens Then they are ranked by cash blocked, margin at risk and days of delay and each shows reason, owner and next action
F-20-AC2 Given any exception card When the owner opens 'why am I seeing this' Then the rule, threshold and value that raised it are shown in 1 line
F-20-AC3 Given the home in light and dark themes at 1280 px When the layout gates run Then 0 contrast failures, no horizontal scroll and no empty cell
F-20-AC4 Given a user without the finance permission When they open the home Then money figures are hidden and 0 hidden values appear in the page source

F-21-AC1 Given each of the 7 widgets When a number is opened Then the source records open in 1 step and the calculation is explained in plain words
F-21-AC2 Given a figure from a manual entry or a stale sync When it is displayed Then it carries 1 label of live, estimated, stale or manually entered and the last update time
F-21-AC3 Given 40 live projects and 5 years of history When the home loads on a throttled mid-range phone Then it renders in 2.5 seconds or less at p95 over 100 runs
F-21-AC4 Given a widget with no data When it is displayed Then it shows an empty state with the next action, not a blank

F-22-AC1 Given 5 pending requests of 4 kinds When the queue opens Then each shows amount, age, requester and the 3 facts the decision needs
F-22-AC2 Given the requester of a request When they open the same request Then approve and reject are not offered and the server refuses the call with a 403 response
F-22-AC3 Given an approval When it is recorded Then 4 of 4 fields (actor, time, decision, note) are stored and the downstream record changes state in the same transaction
F-22-AC4 Given a request older than 2 days When the queue is read Then it is marked overdue and appears in the exceptions list

F-23-AC1 Given a task created from a stage record When it is assigned with a due date Then it shows on the assignee's list and on the project timeline, 2 of 2
F-23-AC2 Given a task due tomorrow When the reminder job runs Then 1 reminder is sent and 0 duplicates follow on retry
F-23-AC3 Given a task for a project in another branch When a user without that scope lists tasks Then 0 such tasks appear

F-29-AC1 Given a supplier with a GSTIN When it is saved Then the 15-character GSTIN format check passes or the save is refused with 1 field message
F-29-AC2 Given 2 suppliers with the same GSTIN When the second is saved Then a duplicate warning names the first and the save needs confirmation
F-29-AC3 Given a supplier with 3 late deliveries out of 10 When its record is opened Then the on-time rate is shown as 70%

F-30-AC1 Given a BOM line of 40 panels When 42 are ordered Then the over-order is flagged against the approved quantity and the variance of 2 is shown
F-30-AC2 Given a line with 40 ordered and 30 received When 20 are reserved Then the reservation is refused because it exceeds the received and unreserved 30
F-30-AC3 Given a BOM edited after approval When the edit is saved Then revision 2 is created and revision 1 stays readable
F-30-AC4 Given a quantity moving through 7 states When the invariants are tested on 10,000 random sequences Then 0 sequences leave a negative or inconsistent quantity

F-31-AC1 Given 6 BOM lines and 3 suppliers When the request is sent Then 3 requests are created and each supplier sees only its own 6 lines
F-31-AC2 Given a quote link When it is guessed or opened after expiry Then the response is not found and 0 data is shown; a link of 128 bits or more is not guessable in 10,000 attempts
F-31-AC3 Given a supplier who submits 6 quote lines through the link When they are received Then the 6 lines are validated and attached to the right request, and a line with a negative price is refused
F-31-AC4 Given 2 of 3 suppliers have replied When the request is read Then responses show 2 of 3 and the validity date of each

F-32-AC1 Given 3 quotes for the same 6 lines When the comparison opens Then price, GST, freight, delivery date, warranty and payment terms are shown side by side for 6 of 6 lines
F-32-AC2 Given a quote missing freight When the comparison is read Then 1 incomplete flag shows and its landed cost is marked partial
F-32-AC3 Given quotes of 100,000, 98,000 and 99,500 rupees before freight of 0, 4,000 and 1,000 When landed cost is calculated Then the order is 100,000, 100,500 and 102,000 and the cheapest is the first
F-32-AC4 Given a chosen quote When a purchase order is started Then its lines, prices and terms are copied with 0 retyped fields

F-33-AC1 Given a purchase order with the same number or the same lines as an open order When it is saved Then the save is refused and 1 existing order is shown
F-33-AC2 Given a purchase order of 2,50,000 rupees against a threshold of 1,00,000 When it is submitted Then it goes to the approval queue and cannot be sent to the supplier
F-33-AC3 Given an approved order When its lines are read Then each line links to its BOM line and the ordered quantity updates in the same transaction
F-33-AC4 Given a purchase order sent to a supplier When its price is edited Then the edit is refused and revision 2 is required

F-34-AC1 Given a promised delivery moved from 10 to 17 November When the change is saved Then the log holds old and new dates and the 3 dependent jobs are listed
F-34-AC2 Given a promise 2 days from the required-by date with no confirmation When the evaluator runs Then 1 supplier delay exception is raised
F-34-AC3 Given a supplier with 5 ETA changes in 30 days When its record is read Then the count of 5 and the average slip in days are shown

F-37-AC1 Given an order of 100 panels When 60 arrive, 2 are rejected with a photo Then stock increases by 58 and the order shows 58 received of 100
F-37-AC2 Given a serial number that already exists When it is captured again Then the capture is refused and 1 earlier record is shown
F-37-AC3 Given 40 serial numbers scanned for a delivery of 40 When the receipt is saved Then 40 serials are linked to the order line and the warranty start is empty until commissioning
F-37-AC4 Given a delivery of 105 against an order of 100 When it is received Then the 5 extra units are flagged as over-delivery and need approval before stock is added

F-38-AC1 Given any stock movement When it is recorded Then an entry with item, quantity, from, to, status, actor and time is appended and 0 existing entries change
F-38-AC2 Given 100 inverters of which 40 are reserved When 50 more are reserved to another project Then the second reservation is refused for the 10 unavailable and shows the 40 and 50 balance
F-38-AC3 Given 2 users reserving the last 10 units at the same moment When both submit Then exactly 1 succeeds and 1 is refused, over 1,000 repeated runs
F-38-AC4 Given stock for a project in branch A When a user scoped to branch B reads stock Then 0 rows are returned

F-39-AC1 Given a project needing 40 panels by 20 November with 10 in stock and 20 on a confirmed order for 18 November When availability is read Then the shortfall of 10 is shown with the 3 actions: expedite, substitute, transfer
F-39-AC2 Given an order with an unconfirmed date When availability is read Then its quantity adds 0 to the covered total
F-39-AC3 Given the same unit promised to 2 projects When availability is read Then the conflict is shown on both projects, 2 of 2

F-40-AC1 Given a job with 1 missing material line When the gate is read Then the status is blocked and the reason names the line
F-40-AC2 Given a blocked job with a crew booked When the schedule is saved Then 1 warning is shown and an override needs 1 approver and 1 reason
F-40-AC3 Given a job with all 6 checks passed When the gate is read Then the status is ready and the evidence of each check is linked
F-40-AC4 Given a gate that changes from ready to blocked When the change is detected Then 1 exception is raised for the project manager within 5 minutes

F-42-AC1 Given a budget of 100 and a purchase order of 40 When the project cost view is read Then committed is 40, actual is 0 and remaining budget is 60
F-42-AC2 Given the supplier bill of 40 against that order When it is recorded Then committed falls to 0, actual is 40 and the total cost stays 40, not 80
F-42-AC3 Given a payment of 40 to the supplier When it is recorded Then the liability is settled and cost does not change
F-42-AC4 Given 10,000 random event sequences When the cost ledger is checked Then 0 sequences count a rupee twice

F-43-AC1 Given a contract of 500,000 rupees, actual 200,000 and 250,000 still forecast When forecast margin is read Then it is 50,000 rupees, 10%, and the baseline variance is shown
F-43-AC2 Given a margin floor of 12% and a forecast of 9% When the evaluator runs Then 1 exception is raised with the 3 largest drivers named
F-43-AC3 Given a driver of transport cost above budget When it is opened Then all cost lines behind it are listed and total the driver amount with a difference of 0 paise
F-43-AC4 Given a forecast at the commissioning milestone When the job closes Then 2 values, forecast and realised margin, are stored for the accuracy metric

F-46-AC1 Given a baseline with 4 milestones When the billing plan is created Then 4 plan lines with percentage and amount exist and sum to the contract value to the paise
F-46-AC2 Given an invoice record When a user edits its amount Then the edit is refused and 1 linked credit-note record is the only correction
F-46-AC3 Given an invoice record with taxable value, rate and tax split When it is saved Then the parts sum to the total with a difference of 0 paise or the save is refused
F-46-AC4 Given a milestone reached with no invoice after 7 days When the evaluator runs Then 1 unbilled-milestone exception is raised

F-47-AC1 Given an invoice of 100,000 rupees and a receipt of 60,000 When the ledger is read Then the balance is 40,000 and the invoice shows partly paid
F-47-AC2 Given a retention of 5% and a disputed 10,000 When ageing is read Then both are shown in their own columns and excluded from overdue
F-47-AC3 Given an invoice 45 days overdue whose final milestone waits on commissioning and an open utility query When its blocked-by chain is opened Then 3 links are shown in order with owners
F-47-AC4 Given a receipt entered twice with the same reference When it is saved Then the second is refused as a duplicate and 1 receipt exists

F-54-AC1 Given a request for quotation When it is sent Then 1 email per supplier leaves with the private link and the send is logged with 0 secrets in the log
F-54-AC2 Given the sending domain without SPF, DKIM or DMARC When the setup check runs Then the 3 missing records are listed and sending is held
F-54-AC3 Given a send that fails and is retried When it eventually succeeds Then the supplier receives exactly 1 email

F-55-AC1 Given a seeded company with 25 projects When a full export is requested Then it completes in 24 hours or less and holds every table, attachment and history with a checksum that verifies
F-55-AC2 Given a cell beginning with = in the data When it is exported to CSV Then it is prefixed so it opens as text in 100% of such cells
F-55-AC3 Given a user without the export permission When they request an export Then the request is refused and 1 denied entry is audited
F-55-AC4 Given a download link When it is used after 5 minutes Then it is rejected

# 5. Non-functional requirements
| ID | Area | Requirement | How verified |
|----|------|-------------|--------------|
| NF-01 | Performance | Owner home loads with 40 live projects and 5 years of history in 2.5 seconds at p95 on a mid-range phone over a 4G connection | Playwright run with throttled network and CPU, 100 runs |
| NF-02 | Performance | Import of a 5,000-row sheet validates and reports errors in 60 seconds or less | Timed import test with seeded sheets |
| NF-03 | Performance | Nightly exception evaluation for one tenant with 40 live projects finishes in 30 seconds or less | Job duration metric on the seeded tenant |
| NF-04 | Accuracy | Amounts are stored as integer paise; the sum of line amounts equals the document total in 100% of 10,000 generated cases | Property test on the money library |
| NF-05 | Availability | Monthly availability of 99.5% for web and API; recovery point 15 minutes and recovery time 4 hours | Uptime monitor and a quarterly restore drill |
| NF-06 | Field use | Site app keeps 72 hours of queued work offline and shows queued and synced state on 100% of items; a conflict never overwrites silently | Offline test with airplane mode and forced conflicts |
| NF-07 | Security | 0 open Critical or High findings at each pilot gate; 0 cross-tenant reads across 100% of pack tables | Tenant matrix in CI and review at each gate |
| NF-08 | Accessibility | WCAG 2.2 AA on every pack screen in light and dark, 0 contrast failures | axe scan and design/tools/contrast.py in CI |
| NF-09 | Residency | 100% of tenant data and backups held in the Mumbai region | Infrastructure config assertion and a monthly check |
| NF-10 | Portability | A tenant exports every record, attachment and history in documented CSV and JSON within 24 hours of request | Export drill on the seeded tenant, with checksum |

# 6. Constraints
Industry and country: Indian solar EPC; DPDP duties, GST records, state utility and PM Surya Ghar stages; ALMM and DCR flags. Rates, stages and flags are data because they change.
Integrations: Tally by file exchange first; email now; WhatsApp later through a provider; utility and subsidy portals have no public API, so stages and evidence are recorded by people.
Tech mandates: ADR-0006 stack; the pack uses foundation public APIs only and adds 0 industry words to foundation packages (G-01).
Existing systems and data to migrate: owner sheets and CRM exports through the guided import.
Budget: Not set.
Deadline: None fixed; each pilot gate decides the next phase.
Team: Aadarsh decides and accepts; a design partner owner confirms definitions and stage lists; agents build and review under packs/epc/docs/plans/README.md.

# 7. Out of scope
| ID | Not building | Why | Revisit |
|----|--------------|-----|---------|
| X-01 | PV design, shading and yield simulation | Design tools do this well; integrate by import | after 3 paying customers ask |
| X-02 | Inverter and plant monitoring | Needs vendor portals and device data; not the wedge | after service features (N-19) |
| X-03 | Payroll, statutory accounting, GST filing and e-invoicing | Tally stays the books; the pack records and syncs | after decision Q-03 |
| X-04 | Lead marketplace and marketing automation | Sales side is largely served by CRMs; import won deals instead | after decision Q-10 |
| X-05 | Automating utility or subsidy portals, or storing the owner's portal passwords | No public API; credentials would be a liability | if an official API appears |
| X-06 | Native mobile apps | An installable web app covers field use first | after field adoption is proven |
| X-07 | Utility-scale EPC (above 1 MW) project controls | Different workflows and buyers | not planned |
| X-08 | Autonomous AI actions on records | Suggestions need human confirmation (ADR-0005) | not planned |

# 8. Assumptions and risks
| ID | Assumption or risk | Likelihood | Impact | Mitigation | Owner |
|----|--------------------|-----------|--------|------------|-------|
| R-01 | Residential subsidy ends and demand for small installers falls | High | High | Target mid-size and commercial EPCs; keep residential as an on-ramp | Aadarsh |
| R-02 | No owner pays: the pain is real but willingness to pay is untested | Medium | High | Phase 0 conversations and a paid pilot offer before more code; gate G1 needs 3 paid commitments | Aadarsh |
| R-03 | Rivals add procurement and margin screens | Medium | Medium | Own the India depth: state stage templates, ALMM and DCR flags, Tally sync | Aadarsh |
| R-04 | Every owner's sheet and utility stages differ by state | High | Medium | Three canonical import layouts, a mapping screen, stage templates as data, 1 or 2 states first | gx-implementer |
| R-05 | Field adoption is low because phone updates take effort | High | High | Few taps, photos, offline with visible sync; onboard supervisors first; measure weekly active crews | Aadarsh |
| R-06 | Offline storage on a phone conflicts with the rule of no personal data in browser storage | High | High | Decision Q-05 and an ADR before any offline task; minimal fields, encrypted, wiped on logout | gx-planner |
| R-07 | The foundation is late, so the pilot is late | Medium | High | Pack builds against core ports and fakes during waves 0 to 2; a demo and Phase 0 run in parallel; start the privacy and files modules before the entitlements module in wave 4 | Aadarsh |
| R-08 | Wrong numbers lose trust | Medium | High | Freshness labels, source drill-down, import row errors, reconcile screens | gx-implementer |
| R-09 | Tally sync formats vary by version and by accountant | Medium | Medium | Export and import files first; confirm the version with the design partner; reconcile queue | gx-implementer |
| R-10 | Agency work competes for build time | Medium | Medium | Fixed weekly build hours; agents carry the build under one lane each | Aadarsh |
| R-11 | Stage definitions or compliance rules change mid-pilot (ALMM, GST, subsidy rules) | High | Medium | Rates, stages and flags are data; the weekly industry brief watches for changes | Aadarsh |

# 9. Success and launch criteria
Success (90 days after the first paid pilot starts): G-02 holds for 5 of 5 cold owners, G-03 holds for 3 of 3 pilots, and G-06 reaches 3 paid conversions.
Launch gate: all Must features pass their acceptance criteria on staging; 0 open Critical or High security findings; the 10-request privacy drill passes; restore drill passed; a pilot owner signs the paid plan.

# 10. Brand
Guide: docs/design/design-system.md and docs/prd/brand/ in the repository root
Tone of voice: precise, calm, businesslike; plain words for crews in Hindi, Marathi and Gujarati
References: Salesforce Lightning density and structure; one orange action per view

# 11. Open questions and decisions
| ID | Question | Owner | Needed by | Answer |
|----|----------|-------|-----------|--------|
| Q-01 | Which one or two states and utilities do we configure first, and who confirms their stage lists? | Aadarsh with the design partner | before E2-T02 | Open. Lean: the state of the design partner plus one more where you already know owners. |
| Q-02 | Who is the design partner owner and which 3 to 5 companies are the pilots? | Aadarsh | before E3-T01 | Open. Lean: one design partner for definitions, three paid pilots from the EPCs already contacted. |
| Q-03 | Do we issue GST invoices in the pack, or record and sync invoices from Tally? | Aadarsh with a chartered accountant | before E7-T02 | Open. Lean: record and sync; issuing invoices adds e-invoicing and numbering duties (CMP-22, CMP-23) for little extra value. |
| Q-04 | Do pilot companies hold warehouse stock, or buy project by project straight to site? | Aadarsh from interviews | before E5-T04 | Open. Lean: build for both with warehouse and site as locations; test in interviews. |
| Q-05 | What may the site app keep on the phone while offline? | Aadarsh with gx-planner | before E8-T01 | Open. Lean: the day's assigned jobs and drafts only, encrypted, removed on sign-out and after 72 hours; record as an ADR. |
| Q-06 | What is the pilot offer: price, length and what the owner gives in return? | Aadarsh | before gate G1 | Open. Lean: paid even if small; hypothesis of 5,000 rupees per company per month including a defined user and project allowance. |
| Q-07 | How are the pack and its modules packaged into plans and limits? | Aadarsh | before foundation K3 tasks are used by the pack | Open. Lean: one plan with project and user allowances at launch; modules switched on per tenant. |
| Q-08 | Which accounting tool beyond Tally do the first 10 targets use? | Aadarsh from interviews | before E9-T03 | Open. Lean: Tally only until interviews show otherwise. |
| Q-09 | Which WhatsApp business provider, and who bears the per-message cost? | Aadarsh | before E9-T06 | Open. Lean: customer-owned verified business number; confirm cost before promising it. |
| Q-10 | Do we build lead and quote tools, or import won deals from the owner's CRM? | Aadarsh | before any Later sales feature | Decided (lean accepted for planning). Import won deals; sales features stay Later until pilots ask for them. |
| Q-11 | When does the distributor or dealer (Trade) pack start? | Aadarsh | after gate G4 | Deferred. EPC first; Trade features are Later and need their own interviews. |
| Q-12 | Which foundation order lets a pilot start earliest? | Aadarsh | before foundation wave 4 | Open. Lean: inside wave 4, build identity and workflow first and entitlements last; do files and the privacy desk right after, since a pilot with real customer data needs both. |

# 12. Sign-off
Baseline v1.0 approved by: pending (Aadarsh Mishra)
Later changes only via docs/prd/changes/CR-xxx.md in this pack
