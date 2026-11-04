"""EPC pack: project-level PRD content (goals, users, needs, NFs, scope, risks, decisions, milestones).

Sources: the earlier research PRD (63 features, R1 to R3), the owner-day feature map (Today, spine) and the build plan
(Excel-connected dashboard first), reconciled against the foundation (docs/prd/01-prd.md, features F-01 to F-67).
Placeholders in angle brackets are avoided on purpose: prdtool lint flags them.
"""

GOALS = [
    ("G-01", "The EPC pack runs on foundation public APIs only, so a later vertical can cherry-pick the foundation",
     "Foundation files edited for the pack plus industry words found in foundation packages", "no pack exists", "0 edits and 0 words", "every merge; extraction drill at the end of foundation wave 5"),
    ("G-02", "An owner sees what is stuck, why, who owns it and what it costs without calling anyone",
     "Seconds for a cold owner on sample data to name the 3 most urgent items", "not measured (sheets and calls take minutes)", "30 seconds or fewer for 5 of 5 owners", "pilot gate G2"),
    ("G-03", "Pilot owners stop keeping a parallel spreadsheet for the covered workflow",
     "Pilot companies with no shadow spreadsheet for utility stages, material and margin", "0 of 3", "3 of 3 pilots", "pilot gate G3"),
    ("G-04", "Utility-stage data is trustworthy enough to act on",
     "Pilot jobs whose recorded stage matches the portal reference at a weekly spot check", "not measured", "95% or more of sampled jobs across 4 weekly checks", "pilot gate G2"),
    ("G-05", "Forecast margin predicts real margin",
     "Closed pilot jobs whose forecast margin at the commissioning milestone is within 5 percentage points of realised margin", "not measured", "80% or more of closed jobs", "pilot gate G4"),
    ("G-06", "Pilots become paying customers",
     "Pilot companies that sign a paid plan after the paid trial", "0 of 0", "3 or more", "pilot gate G4"),
    ("G-07", "Customer data handling meets DPDP duties from the first pilot",
     "Seeded access, correction and erasure requests completed inside the configured limit, and open Critical or High security findings", "no desk exists", "10 of 10 requests and 0 findings", "before the first pilot uses real customer data"),
]

USERS = [
    ("U-01", "Owner or admin", "Owner of an Indian solar EPC or installer with 10 to 40 live projects and 15 to 100 staff", "laptop and phone, Hindi and English, medium", "Excel, WhatsApp groups, Tally and phone calls", "cannot see what is stuck, what it costs or where margin leaks", "yes"),
    ("U-02", "Project manager", "Plans jobs, chases utility approvals and keeps customers informed", "laptop and phone, Hindi and English, medium", "sheets and chat groups", "approvals stall unseen and documents are repeated", "no"),
    ("U-03", "Procurement", "Buys material, compares quotes and chases suppliers", "laptop and phone, Hindi and English, medium", "WhatsApp quotes and a purchase sheet", "quotes are not comparable and delivery dates slip silently", "no"),
    ("U-04", "Store or receiving", "Receives goods, inspects, records serials and issues to site", "phone and laptop, Hindi and English, low to medium", "paper challans and a stock sheet", "stock on paper differs from stock on the shelf", "no"),
    ("U-05", "Site supervisor", "Leads crews on site and reports progress and blockers", "phone first, Hindi, Marathi or Gujarati, low", "calls and photos on chat", "arrives without material or permits and cannot report in a few steps", "no"),
    ("U-06", "Finance or accounts", "Records invoices, receipts, supplier bills and keeps books in Tally", "laptop, English, medium", "Tally plus a dues sheet", "cannot see profit per job or which dues wait on a utility stage", "no"),
    ("U-07", "Sales or surveyor", "Surveys sites, estimates and hands won deals to operations", "phone and laptop, Hindi and English, medium", "a CRM or sheets", "won-deal data is retyped at handoff", "no"),
    ("U-08", "Service coordinator", "Handles warranty, AMC and service visits after handover", "phone and laptop, Hindi and English, medium", "a diary and calls", "warranty and AMC dates are not tied to the install record", "no"),
]

NEEDS = [
    ("N-01", "As U-01 I need one list of exceptions, ranked by cash blocked, margin at risk and days of delay, each with a reason, an owner and a next action", "I decide from one view without calling five people", "G-02", "Must"),
    ("N-02", "As U-01 I need every figure to open the records behind it and show how fresh it is", "I trust the numbers enough to act on them", "G-02, G-05", "Must"),
    ("N-03", "As U-01 I need to see the contract value of jobs installed but not energised or not yet claimed, grouped by blocker", "I know why cash is stuck", "G-02, G-04", "Must"),
    ("N-04", "As U-01 I need to approve purchase orders, change requests and expenses with the context shown beside the request", "decisions are made within one working day and stay traceable", "G-02", "Must"),
    ("N-05", "As U-02 I need each job to carry its utility and subsidy stage, who owes the next step, its age and the documents required", "no approval stalls unseen", "G-03, G-04", "Must"),
    ("N-06", "As U-02 I need reminders and escalation when a stage ages past its limit", "delays reach the owner before they cost money", "G-04", "Must"),
    ("N-07", "As U-02 I need to bring my existing project sheets in without retyping and see every row error", "switching costs hours, not weeks", "G-03", "Must"),
    ("N-08", "As U-03 I need to request quotes for BOM lines from several suppliers, compare them on landed cost and raise an approved purchase order", "I buy the right material at the right price once", "G-03, G-05", "Must"),
    ("N-09", "As U-03 I need to record each supplier's promised dates and every change", "late material is known before the crew is booked", "G-03", "Must"),
    ("N-10", "As U-04 I need to receive goods against purchase orders, inspect them and record serial numbers", "only accepted material counts as stock", "G-03", "Must"),
    ("N-11", "As U-02 I need to know before a crew leaves whether material, permits and access are ready", "crews do not travel to blocked sites", "G-03, G-05", "Must"),
    ("N-12", "As U-06 I need budget, commitments and actual cost kept distinct per job and a forecast margin from them", "I see a margin leak while the job is open", "G-05", "Must"),
    ("N-13", "As U-06 I need milestone invoices, receipts, retention and disputes tracked with ageing, and subsidy kept separate from customer dues", "collections are chased on the right people", "G-02, G-03", "Must"),
    ("N-14", "As U-05 I need a daily plan, checklist, photos and blocker reports that work with weak signal", "site updates reach the office the same day", "G-03", "Should"),
    ("N-15", "As U-06 I need records to flow to and from Tally without double entry", "books and operations agree", "G-03", "Should"),
    ("N-16", "As U-01 I need customer data protected, exportable and erasable on request, with my data in an Indian region", "I meet my privacy duties and can leave with my data", "G-07", "Must"),
    ("N-17", "As U-01 I need roles and approval limits that separate who requests, approves and pays", "no single person can commit or pay alone above a threshold", "G-01, G-07", "Must"),
    ("N-18", "As U-07 I need a won deal to become a project with its customer and site data intact", "handoff does not lose or retype anything", "G-03", "Must"),
    ("N-19", "As U-08 I need warranty and AMC tied to the serials installed at each site", "service starts from the install record", "G-06", "Later"),
    ("N-21", "As U-01 I need the pack to run on an isolated, audited foundation that keeps my company's data apart from every other company", "my data is never visible to another firm and every change has a record", "G-01, G-07", "Must"),
    ("N-20", "As U-01 I need a weekly summary of what moved, what is stuck and what to fix", "I run a review without building one by hand", "G-02", "Should"),
]

NFS = [
    ("NF-01", "Performance", "Owner home loads with 40 live projects and 5 years of history in 2.5 seconds at p95 on a mid-range phone over a 4G connection", "Playwright run with throttled network and CPU, 100 runs"),
    ("NF-02", "Performance", "Import of a 5,000-row sheet validates and reports errors in 60 seconds or less", "Timed import test with seeded sheets"),
    ("NF-03", "Performance", "Nightly exception evaluation for one tenant with 40 live projects finishes in 30 seconds or less", "Job duration metric on the seeded tenant"),
    ("NF-04", "Accuracy", "Amounts are stored as integer paise; the sum of line amounts equals the document total in 100% of 10,000 generated cases", "Property test on the money library"),
    ("NF-05", "Availability", "Monthly availability of 99.5% for web and API; recovery point 15 minutes and recovery time 4 hours", "Uptime monitor and a quarterly restore drill"),
    ("NF-06", "Field use", "Site app keeps 72 hours of queued work offline and shows queued and synced state on 100% of items; a conflict never overwrites silently", "Offline test with airplane mode and forced conflicts"),
    ("NF-07", "Security", "0 open Critical or High findings at each pilot gate; 0 cross-tenant reads across 100% of pack tables", "Tenant matrix in CI and review at each gate"),
    ("NF-08", "Accessibility", "WCAG 2.2 AA on every pack screen in light and dark, 0 contrast failures", "axe scan and design/tools/contrast.py in CI"),
    ("NF-09", "Residency", "100% of tenant data and backups held in the Mumbai region", "Infrastructure config assertion and a monthly check"),
    ("NF-10", "Portability", "A tenant exports every record, attachment and history in documented CSV and JSON within 24 hours of request", "Export drill on the seeded tenant, with checksum"),
]

OUT_OF_SCOPE = [
    ("X-01", "PV design, shading and yield simulation", "Design tools do this well; integrate by import", "after 3 paying customers ask"),
    ("X-02", "Inverter and plant monitoring", "Needs vendor portals and device data; not the wedge", "after service features (N-19)"),
    ("X-03", "Payroll, statutory accounting, GST filing and e-invoicing", "Tally stays the books; the pack records and syncs", "after decision Q-03"),
    ("X-04", "Lead marketplace and marketing automation", "Sales side is largely served by CRMs; import won deals instead", "after decision Q-10"),
    ("X-05", "Automating utility or subsidy portals, or storing the owner's portal passwords", "No public API; credentials would be a liability", "if an official API appears"),
    ("X-06", "Native mobile apps", "An installable web app covers field use first", "after field adoption is proven"),
    ("X-07", "Utility-scale EPC (above 1 MW) project controls", "Different workflows and buyers", "not planned"),
    ("X-08", "Autonomous AI actions on records", "Suggestions need human confirmation (ADR-0005)", "not planned"),
]

RISKS = [
    ("R-01", "Residential subsidy ends and demand for small installers falls", "High", "High", "Target mid-size and commercial EPCs; keep residential as an on-ramp", "Aadarsh"),
    ("R-02", "No owner pays: the pain is real but willingness to pay is untested", "Medium", "High", "Phase 0 conversations and a paid pilot offer before more code; gate G1 needs 3 paid commitments", "Aadarsh"),
    ("R-03", "Rivals add procurement and margin screens", "Medium", "Medium", "Own the India depth: state stage templates, ALMM and DCR flags, Tally sync", "Aadarsh"),
    ("R-04", "Every owner's sheet and utility stages differ by state", "High", "Medium", "Three canonical import layouts, a mapping screen, stage templates as data, 1 or 2 states first", "gx-implementer"),
    ("R-05", "Field adoption is low because phone updates take effort", "High", "High", "Few taps, photos, offline with visible sync; onboard supervisors first; measure weekly active crews", "Aadarsh"),
    ("R-06", "Offline storage on a phone conflicts with the rule of no personal data in browser storage", "High", "High", "Decision Q-05 and an ADR before any offline task; minimal fields, encrypted, wiped on logout", "gx-planner"),
    ("R-07", "The foundation is late, so the pilot is late", "Medium", "High", "Pack builds against core ports and fakes during waves 0 to 2; a demo and Phase 0 run in parallel; start the privacy and files modules before the entitlements module in wave 4", "Aadarsh"),
    ("R-08", "Wrong numbers lose trust", "Medium", "High", "Freshness labels, source drill-down, import row errors, reconcile screens", "gx-implementer"),
    ("R-09", "Tally sync formats vary by version and by accountant", "Medium", "Medium", "Export and import files first; confirm the version with the design partner; reconcile queue", "gx-implementer"),
    ("R-10", "Agency work competes for build time", "Medium", "Medium", "Fixed weekly build hours; agents carry the build under one lane each", "Aadarsh"),
    ("R-11", "Stage definitions or compliance rules change mid-pilot (ALMM, GST, subsidy rules)", "High", "Medium", "Rates, stages and flags are data; the weekly industry brief watches for changes", "Aadarsh"),
]

DECISIONS = [
    ("Q-01", "Which one or two states and utilities do we configure first, and who confirms their stage lists?", "Aadarsh with the design partner", "before E2-T02",
     "Open. Lean: the state of the design partner plus one more where you already know owners."),
    ("Q-02", "Who is the design partner owner and which 3 to 5 companies are the pilots?", "Aadarsh", "before E3-T01",
     "Open. Lean: one design partner for definitions, three paid pilots from the EPCs already contacted."),
    ("Q-03", "Do we issue GST invoices in the pack, or record and sync invoices from Tally?", "Aadarsh with a chartered accountant", "before E7-T02",
     "Open. Lean: record and sync; issuing invoices adds e-invoicing and numbering duties (CMP-22, CMP-23) for little extra value."),
    ("Q-04", "Do pilot companies hold warehouse stock, or buy project by project straight to site?", "Aadarsh from interviews", "before E5-T04",
     "Open. Lean: build for both with warehouse and site as locations; test in interviews."),
    ("Q-05", "What may the site app keep on the phone while offline?", "Aadarsh with gx-planner", "before E8-T01",
     "Open. Lean: the day's assigned jobs and drafts only, encrypted, removed on sign-out and after 72 hours; record as an ADR."),
    ("Q-06", "What is the pilot offer: price, length and what the owner gives in return?", "Aadarsh", "before gate G1",
     "Open. Lean: paid even if small; hypothesis of 5,000 rupees per company per month including a defined user and project allowance."),
    ("Q-07", "How are the pack and its modules packaged into plans and limits?", "Aadarsh", "before foundation K3 tasks are used by the pack",
     "Open. Lean: one plan with project and user allowances at launch; modules switched on per tenant."),
    ("Q-08", "Which accounting tool beyond Tally do the first 10 targets use?", "Aadarsh from interviews", "before E9-T03",
     "Open. Lean: Tally only until interviews show otherwise."),
    ("Q-09", "Which WhatsApp business provider, and who bears the per-message cost?", "Aadarsh", "before E9-T06",
     "Open. Lean: customer-owned verified business number; confirm cost before promising it."),
    ("Q-10", "Do we build lead and quote tools, or import won deals from the owner's CRM?", "Aadarsh", "before any Later sales feature",
     "Decided (lean accepted for planning). Import won deals; sales features stay Later until pilots ask for them."),
    ("Q-11", "When does the distributor or dealer (Trade) pack start?", "Aadarsh", "after gate G4",
     "Deferred. EPC first; Trade features are Later and need their own interviews."),
    ("Q-12", "Which foundation order lets a pilot start earliest?", "Aadarsh", "before foundation wave 4",
     "Open. Lean: inside wave 4, build identity and workflow first and entitlements last; do files and the privacy desk right after, since a pilot with real customer data needs both."),
]

# (id, outcome, [feature ids], demo)  -- feature ids are resolved by slug in epc_features.py
MILESTONES = [
    ("M-01", "A pitch demo opens on the owner home with sample data and shows exceptions, utility ageing, cash blocked and margin",
     ["demo", "scaffold", "classify"],
     "open the demo tenant; read the exceptions list; open cash blocked and follow one number to its records; switch to dark; show nothing is typed in"),
    ("M-02", "An owner brings a project sheet in, fixes every row error and sees baselined projects",
     ["company", "import", "customer", "handoff", "ptemplates", "roles"],
     "upload a sheet with 3 bad rows; read the error report; fix and re-import twice; open a project with its baseline; try an action as a user without permission and see the denial"),
    ("M-03", "Every job carries its utility stage, owner, age, documents and evidence, and late stages escalate",
     ["stages", "stagerec", "gates", "escal", "cashblock", "email", "tasks", "notices"],
     "load the state template; move a job to a query stage; watch the clock pass its limit; see the task and escalation; open the cash-blocked list grouped by blocker"),
    ("M-04", "The owner opens one exceptions list and decides from it (pilot control loop)",
     ["xrules", "xlife", "home", "widgets", "approvals", "timeline"],
     "seed 5 causes; show 5 exceptions not 50; open the home; drill from a number to a record; approve one PO from the queue; resolve and verify one exception"),
    ("M-05", "A pilot runs material from BOM to receipt to a readiness gate on a live job",
     ["suppliers", "bom", "rfq", "quotecmp", "po", "promises", "grn", "ledger", "avail", "ready", "documents"],
     "request quotes for 6 BOM lines from 3 suppliers; compare landed cost; raise and approve a PO; receive partly with one rejection; see shortfall; watch the gate change from blocked to ready"),
    ("M-06", "Forecast margin and receivables reconcile to source documents",
     ["budget", "margin", "billplan", "receipts", "export", "erase"],
     "open a job; read budget, commitments, actuals and forecast margin; record a milestone invoice and a part receipt; see ageing and the blocked-by chain; export everything and verify the checksum; run an erasure request"),
    ("M-07", "Field updates, Tally sync and collections work on live jobs",
     ["siteapp", "sitework", "calendar", "punch", "handover", "tally", "whatsapp", "bills", "expenses", "collect", "digest", "mobile", "backlog", "dcr", "returns", "bomrev", "transfer"],
     "work a job offline on a phone and sync it; see a conflict surfaced; sync a bill to Tally and reconcile one mismatch; send a reminder; read the Monday digest"),
    ("M-08", "Later features are promoted only when paying pilots ask for them twice",
     ["survey", "estimate", "proposal", "assets", "tickets", "tracking", "dealers", "invoicing", "api", "aiextract", "leads"],
     "review the pilot request log; promote one Later feature through a change request; write its tasks"),
]
