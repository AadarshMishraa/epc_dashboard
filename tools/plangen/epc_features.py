"""EPC pack: feature catalogue. Features are written by slug; ids F-01.. are assigned in order of definition.

Priority: Must = needed for the first paid pilot, Should = needed to replace the owner's sheets completely, Later = on evidence.
Each Must feature has at least 3 acceptance criteria (Given, When, Then) with a number in the result.
Tasks are listed by plan id (E0-T01) and defined in epc_tasks.psv.
"""

F = []


def feat(slug, name, line, pri, needs, tasks, acs=()):
    F.append(dict(slug=slug, name=name, line=line, pri=pri, needs=needs, tasks=tasks, acs=list(acs)))


# ----------------------------------------------------------------------------- E0 pack core
feat("scaffold", "Pack workspace, boundary and money library",
     "Create the pack workspace and manifest, enforce the boundary to the foundation, and provide integer-paise money, units, tax rates as data and a working calendar.",
     "Must", ["N-21"], ["E0-T01", "E0-T02", "E0-T03"], [
         ("the pack workspace", "the boundary lint runs against the foundation", "0 foundation files are edited and 0 industry words are found in foundation packages"),
         ("a pack manifest with an undeclared permission used in code", "the manifest check runs", "it exits with code 1 and names the permission"),
         ("10,000 generated documents with random lines, quantities and rates", "totals are computed", "the sum of line amounts equals the document total in 10,000 of 10,000 cases and no float is used"),
         ("a GST rate change dated 22 September 2025", "an amount is priced on 21 and 22 September", "the first uses the old rate and the second the new rate, 2 of 2 correct"),
         ("a state holiday list and a stage entered on a Friday", "the age in working days is read on the next Tuesday", "it shows 2 working days with the holiday excluded")])
feat("classify", "Data classification and inventory for pack records",
     "Classify every pack field, keep the data inventory current and block fields without a class.",
     "Must", ["N-16", "N-21"], ["E0-T04"], [
         ("a pack entity with a field that has no classification", "the privacy check runs", "it exits with code 1 and names the field"),
         ("the data inventory", "the check compares it with the manifest", "0 manifest fields are missing from the inventory"),
         ("a customer phone number, an email and a site address", "they appear in a log line or an audit diff", "all 3 values are masked in 3 of 3 outputs")])
feat("roles", "Roles, scopes and approval policies",
     "Declare the pack's permissions and default roles, scope them by project and branch, and separate who requests, approves and pays above a threshold.",
     "Must", ["N-17", "N-21"], ["E0-T05", "E0-T06"], [
         ("8 default roles and 40 declared pack actions", "a user in each role tries every action", "each role is denied every action it does not hold, 0 unexpected allows"),
         ("a purchase order above the approval threshold created by user A", "user A tries to approve it", "the approval is refused with a reason code and the audit shows 1 denied attempt"),
         ("a project manager scoped to branch Pune", "they open a project in branch Nagpur", "the response is not found and 0 fields leak"),
         ("the last owner of a company", "their role is removed", "the change is refused, 1 owner remains and the audit holds 1 denied entry")])
feat("company", "Company setup and configuration bundle",
     "Set up branches, warehouses, project types, calendar, GST details, thresholds and labels as data, applied from one bundle.",
     "Must", ["N-07", "N-21"], ["E0-T07", "E0-T08"], [
         ("an empty company", "the EPC bundle is applied", "3 project types, 2 state stage templates, the label set and 8 thresholds exist"),
         ("the same bundle", "it is applied a second time", "0 records change"),
         ("a GSTIN with a wrong check character", "company setup is saved", "it is rejected with a field message and 0 records are written"),
         ("a margin floor changed from 12% to 15%", "the next evaluation runs", "the new value applies and the change appears in the audit with old and new value")])
feat("demo", "Demo and training tenant",
     "A deterministic tenant of synthetic projects, suppliers, stock and utility stages, and a read-only demo of the owner views.",
     "Must", ["N-01", "N-21"], ["E0-T09", "E0-T10"], [
         ("the seed command", "it runs twice on an empty database", "the same 25 projects, 10 suppliers and 40 stock lines exist both times and 0 real personal values are present"),
         ("a cold viewer on the demo home", "they are asked to name the 3 most urgent items", "5 of 5 test viewers answer in 30 seconds or less"),
         ("the demo in light and dark themes", "the contrast and colour-budget gates run", "0 contrast failures and at most 20% orange")])
feat("erase", "Erase, export and retention handlers",
     "Register erase and export handlers for every pack module that holds personal data and keep statutory records when erasing.",
     "Must", ["N-16"], ["E0-T11", "E0-T12"], [
         ("a seeded customer with 3 projects, 2 photos and a receipt", "an erasure request is run", "personal fields are removed or anonymised in 100% of handlers and the invoice and receipt records are kept with the reason recorded"),
         ("the same customer", "an export request is run", "one machine-readable file lists every record and attachment for that customer, and its checksum verifies"),
         ("a retention schedule of 6 years for invoice records and 1 year for access logs", "a record passes its period", "the retention job removes or anonymises it and writes 1 deletion record"),
         ("10 seeded requests", "the request drill runs", "10 of 10 complete inside the configured limit")])

feat("documents", "Document generation",
     "Render purchase orders, handover packs and statements as PDFs from templates, in the tenant's languages, with private short-lived access.",
     "Must", ["N-08", "N-21"], ["E0-T13", "E4-T14"], [
         ("a purchase order of 12 lines", "its PDF is generated", "1 PDF lists 12 lines and the totals equal the order total to the paise"),
         ("a template with Hindi, Marathi and Gujarati labels", "a PDF is rendered", "0 missing glyphs across 3 of 3 scripts"),
         ("a generated PDF link", "it is opened after 5 minutes or by another company", "access is refused in 2 of 2 cases"),
         ("a template change", "an existing order is regenerated", "the stored original keeps its content and the new file is version 2 and version 1 is unchanged")])

# ----------------------------------------------------------------------------- E1 projects and import
feat("import", "Guided import from sheets",
     "Bring projects, BOMs, suppliers, stock and customers in from CSV and Excel with column mapping, row-level errors and safe re-import.",
     "Must", ["N-07"], ["E1-T01", "E1-T02", "E1-T03"], [
         ("a sheet of 5,000 rows with 3 bad rows", "the dry run completes", "it finishes in 60 seconds or less, lists exactly 3 row errors with row and column, and writes 0 records"),
         ("the corrected sheet", "it is imported twice", "the second run creates 0 new records and updates 0"),
         ("a cell that starts with = or @ and a file with a macro", "they are imported", "the cell is stored as text with the prefix neutralised and the macro file is rejected, 2 of 2"),
         ("a file of 60 MB", "it is uploaded", "it is refused with a size message before parsing")])
feat("customer", "Customer and site records",
     "Customers, sites, contacts and consent in one record, with duplicate detection that never merges silently.",
     "Must", ["N-18", "N-16"], ["E1-T04", "E1-T05", "E1-T09"], [
         ("two customers with the same phone number in 2 formats", "the duplicate check runs", "both are listed as 1 candidate pair and 0 records are merged"),
         ("a merge confirmed by a user", "it completes", "projects and history of both move to 1 record and the audit holds 1 merge entry with both ids"),
         ("a new customer from import", "it is saved", "the notice version and consent state are stored in 2 of 2 fields, or the row is flagged as missing consent and counted in the error report"),
         ("a user from another company", "they search for the customer's phone number", "0 results are returned")])
feat("handoff", "Won-deal handoff and project baseline",
     "Create a project from a sheet row, a CRM export or manual entry, then freeze scope, contract value, budget and milestones as revision 1.",
     "Must", ["N-18", "N-12"], ["E1-T06", "E1-T07"], [
         ("a won deal in a sheet row", "the handoff runs", "1 project exists with customer, site and contract value and a list of missing fields is shown"),
         ("a project with a baseline", "scope is changed after baseline", "revision 2 is created, revision 1 stays unchanged and the audit holds the reason"),
         ("a baseline with budget lines", "its total is compared with the contract value", "the difference is shown as planned margin in rupees and as a percentage with 2 decimals"),
         ("a handoff row with no contract value", "it is imported", "it is flagged and no baseline is created")])
feat("ptemplates", "Project types and templates",
     "Milestones, tasks, dependencies and required evidence for residential, commercial and 100 kW and above projects.",
     "Must", ["N-05"], ["E1-T08"], [
         ("the 3 project types", "a project is created for each", "each gets its own milestone list, with 8 or more milestones and the required evidence per milestone"),
         ("a template edited by the owner", "a new project is created", "the new project uses the edited template and the 12 existing projects stay unchanged"),
         ("a dependency from installation to material receipt", "installation is scheduled before receipt", "the plan shows 1 dependency warning")])

# ----------------------------------------------------------------------------- E2 utility and subsidy tracker
feat("stages", "Utility and scheme stage templates",
     "Stage lists with limits per state, utility, scheme and project type, kept as editable data and shipped for the first two states.",
     "Must", ["N-05"], ["E2-T01", "E2-T02"], [
         ("the template for state A", "it is applied to a new job", "the job carries every stage with its limit in working days, 100% of the template's stages"),
         ("an owner who renames a stage and changes its limit from 15 to 20 days", "the change is saved", "only new jobs use it, existing jobs keep their stages, and the audit holds 1 entry"),
         ("a stage list for state B", "it is added by configuration alone", "0 code files change"),
         ("a published template", "a draft with a missing exit stage is published", "the publish is refused, 1 message names the stage and 0 jobs change")])
feat("stagerec", "Stage record and clock",
     "Per job: current stage, owner, who the job waits on, date entered, age against the limit and the next action.",
     "Must", ["N-05", "N-06"], ["E2-T03", "E2-T04"], [
         ("a job moved into a query stage waiting on the utility", "the record is saved", "owner, waiting-on party, entry date and next action are all required and 4 of 4 are stored"),
         ("a stage with a 10 working-day limit entered on a Monday", "the age is read 11 working days later", "the job shows 1 day over the limit"),
         ("2 transitions submitted at the same moment", "both are applied", "1 succeeds, 1 is refused as a conflict and the history shows 1 move"),
         ("a job past its limit", "the owner opens the job", "the reason and the blocked-by chain show on the first view with 0 extra steps")])
feat("gates", "Stage document gates and evidence log",
     "A required-document checklist per stage, an override that needs an approver and reason, and an evidence log of references, screenshots and call notes.",
     "Must", ["N-05"], ["E2-T05", "E2-T06"], [
         ("a stage that needs 6 documents and 5 are present", "the job is moved to the next stage", "the move is blocked and the 1 missing document is named"),
         ("a user without approval rights", "they override a gate", "the override is refused; an approver override stores reason, approver and time, 3 of 3 fields"),
         ("a portal reference number, a screenshot and a call note", "they are added to the evidence log", "3 entries exist and none can be edited or deleted afterwards"),
         ("an expired document", "its stage is opened", "the expiry is flagged 30 days before and on the day")])
feat("escal", "Escalation rules",
     "Reminders and tasks when a stage ages past its limit, escalating to the project manager and then to the owner.",
     "Must", ["N-06"], ["E2-T07"], [
         ("a stage with a limit of 10 working days", "it reaches day 11", "1 task is assigned to the project manager and 0 duplicates are created on later runs"),
         ("the same stage 5 working days later with no action", "the escalation runs", "the owner receives 1 exception and the project manager is named"),
         ("the stage is completed", "the next run happens", "open reminders and tasks for it are closed, 0 remain open"),
         ("the escalation job fails midway and is retried", "it completes", "each notification is sent exactly once")])
feat("cashblock", "Cash-blocked value",
     "The contract value of jobs installed but not energised or not yet claimed, grouped by blocker.",
     "Must", ["N-03"], ["E2-T08"], [
         ("12 jobs installed and 5 not yet energised", "the figure is calculated", "it equals the sum of those 5 contract values to the paise"),
         ("jobs grouped by blocker", "the owner opens a group", "each job in it is listed with its stage, age and owner"),
         ("a job that is energised today", "the figure is read", "it leaves the group in 1 refresh cycle of 5 minutes or less"),
         ("subsidy waiting in the consumer's account", "cash blocked is read", "subsidy adds 0 rupees to the company's receivables")])
feat("dcr", "DCR and ALMM flags",
     "Mark BOM lines and serials as domestic-content or ALMM-compliant and warn before invoicing when data is missing.",
     "Should", ["N-05", "N-11"], ["E2-T09"])

# ----------------------------------------------------------------------------- E3 control tower
feat("xrules", "Exception rules and evaluator",
     "Exception rules as data (condition, threshold, owner, message) evaluated on events and nightly, with one exception per cause.",
     "Must", ["N-01"], ["E3-T01", "E3-T02", "E3-T03", "E3-T05"], [
         ("one late delivery that affects 6 jobs", "the evaluator runs", "1 exception is raised and lists the 6 jobs"),
         ("the same condition still true on the next run", "the evaluator runs again", "0 new exceptions are created and the existing one keeps its age"),
         ("a rule edited by the owner from 7 to 5 days", "the next run happens", "the new threshold applies and the audit holds 1 entry"),
         ("a hostile expression in a rule", "the rule is saved", "it is rejected and 0 rules change"),
         ("the nightly run for 40 live projects", "it completes", "it takes 30 seconds or less and runs once per company per night")])
feat("xlife", "Exception lifecycle",
     "Detected, assigned, acknowledged, action planned, resolved and verified, with reopen needing a reason and time to resolve measured.",
     "Must", ["N-01"], ["E3-T04"], [
         ("a new exception", "it moves through the 6 states", "each move records actor and time and out-of-order moves are refused"),
         ("a resolved exception", "it is reopened", "a reason is required and the reopen count rises by 1"),
         ("10 exceptions resolved in a week", "the metric is read", "median time from detection to verified closure is shown by category")])
feat("home", "Owner home: ranked exceptions and pulse strip",
     "The home view lists open exceptions ranked by impact with reason, owner and next action, above five pulse numbers.",
     "Must", ["N-01"], ["E3-T06", "E3-T08"], [
         ("12 open exceptions with different impacts", "the home opens", "they are ranked by cash blocked, margin at risk and days of delay and each shows reason, owner and next action"),
         ("any exception card", "the owner opens 'why am I seeing this'", "the rule, threshold and value that raised it are shown in 1 line"),
         ("the home in light and dark themes at 1280 px", "the layout gates run", "0 contrast failures, no horizontal scroll and no empty cell"),
         ("a user without the finance permission", "they open the home", "money figures are hidden and 0 hidden values appear in the page source")])
feat("widgets", "Portfolio widgets, drill-down and freshness",
     "Projects at risk, material shortfalls, supplier delay risk, utility ageing, margin variance, receivables ageing and approvals, each opening its source records.",
     "Must", ["N-01", "N-02"], ["E3-T07", "E3-T09"], [
         ("each of the 7 widgets", "a number is opened", "the source records open in 1 step and the calculation is explained in plain words"),
         ("a figure from a manual entry or a stale sync", "it is displayed", "it carries 1 label of live, estimated, stale or manually entered and the last update time"),
         ("40 live projects and 5 years of history", "the home loads on a throttled mid-range phone", "it renders in 2.5 seconds or less at p95 over 100 runs"),
         ("a widget with no data", "it is displayed", "it shows an empty state with the next action, not a blank")])
feat("approvals", "Approval queue",
     "One queue for purchase orders, change requests, expenses and readiness overrides, with the context shown beside each request.",
     "Must", ["N-04", "N-17"], ["E3-T10"], [
         ("5 pending requests of 4 kinds", "the queue opens", "each shows amount, age, requester and the 3 facts the decision needs"),
         ("the requester of a request", "they open the same request", "approve and reject are not offered and the server refuses the call with a 403 response"),
         ("an approval", "it is recorded", "4 of 4 fields (actor, time, decision, note) are stored and the downstream record changes state in the same transaction"),
         ("a request older than 2 days", "the queue is read", "it is marked overdue and appears in the exceptions list")])
feat("tasks", "Tasks and reminders",
     "One task model across records: assign, due date, reminders and a link to the record.",
     "Must", ["N-06"], ["E3-T14", "E3-T15"], [
         ("a task created from a stage record", "it is assigned with a due date", "it shows on the assignee's list and on the project timeline, 2 of 2"),
         ("a task due tomorrow", "the reminder job runs", "1 reminder is sent and 0 duplicates follow on retry"),
         ("a task for a project in another branch", "a user without that scope lists tasks", "0 such tasks appear")])
feat("timeline", "Record timeline",
     "One history per project, customer and supplier showing messages, documents, photos, stage moves, approvals and money in time order.",
     "Should", ["N-02"], ["E3-T16"])
feat("notices", "In-app notices",
     "A notification list and unread count for tasks, approvals and exceptions assigned to the person.",
     "Should", ["N-06"], ["E3-T17"])
feat("backlog", "Backlog against crew capacity",
     "Signed but uninstalled jobs by age against crew capacity, warning before the 60-day line.",
     "Should", ["N-01"], ["E3-T11"])
feat("digest", "Daily and weekly digest",
     "A summary to the owner by email of top exceptions, cash blocked and margin movers.",
     "Should", ["N-20"], ["E3-T12"])
feat("mobile", "Owner mobile view",
     "Exceptions, approvals and cash blocked first on a phone.",
     "Should", ["N-01", "N-04"], ["E3-T13"])

# ----------------------------------------------------------------------------- E4 materials and procurement
feat("suppliers", "Supplier master",
     "Suppliers with categories, GST details, payment terms, credit limit, service area and delivery and quality history.",
     "Must", ["N-08"], ["E4-T01"], [
         ("a supplier with a GSTIN", "it is saved", "the 15-character GSTIN format check passes or the save is refused with 1 field message"),
         ("2 suppliers with the same GSTIN", "the second is saved", "a duplicate warning names the first and the save needs confirmation"),
         ("a supplier with 3 late deliveries out of 10", "its record is opened", "the on-time rate is shown as 70%")])
feat("bom", "BOM lines and quantity states",
     "Item, spec, unit, quantity, wastage, alternatives and required-by date per line, with planned, ordered, received, reserved, issued, installed and returned quantities kept consistent.",
     "Must", ["N-08", "N-11"], ["E4-T02", "E4-T03"], [
         ("a BOM line of 40 panels", "42 are ordered", "the over-order is flagged against the approved quantity and the variance of 2 is shown"),
         ("a line with 40 ordered and 30 received", "20 are reserved", "the reservation is refused because it exceeds the received and unreserved 30"),
         ("a BOM edited after approval", "the edit is saved", "revision 2 is created and revision 1 stays readable"),
         ("a quantity moving through 7 states", "the invariants are tested on 10,000 random sequences", "0 sequences leave a negative or inconsistent quantity")])
feat("rfq", "Request for quotation and supplier quote link",
     "Request quotes for selected BOM lines from several suppliers by email or a private link and track responses and validity.",
     "Must", ["N-08"], ["E4-T04", "E4-T05", "E4-T13"], [
         ("6 BOM lines and 3 suppliers", "the request is sent", "3 requests are created and each supplier sees only its own 6 lines"),
         ("a quote link", "it is guessed or opened after expiry", "the response is not found and 0 data is shown; a link of 128 bits or more is not guessable in 10,000 attempts"),
         ("a supplier who submits 6 quote lines through the link", "they are received", "the 6 lines are validated and attached to the right request, and a line with a negative price is refused"),
         ("2 of 3 suppliers have replied", "the request is read", "responses show 2 of 3 and the validity date of each")])
feat("quotecmp", "Quote capture, comparison and landed cost",
     "Enter supplier quotes against the request and compare them side by side on price, GST, freight, delivery, warranty and terms.",
     "Must", ["N-08"], ["E4-T06"], [
         ("3 quotes for the same 6 lines", "the comparison opens", "price, GST, freight, delivery date, warranty and payment terms are shown side by side for 6 of 6 lines"),
         ("a quote missing freight", "the comparison is read", "1 incomplete flag shows and its landed cost is marked partial"),
         ("quotes of 100,000, 98,000 and 99,500 rupees before freight of 0, 4,000 and 1,000", "landed cost is calculated", "the order is 100,000, 100,500 and 102,000 and the cheapest is the first"),
         ("a chosen quote", "a purchase order is started", "its lines, prices and terms are copied with 0 retyped fields")])
feat("po", "Purchase orders and approvals",
     "Raise a purchase order from the chosen quote, with duplicate guards and approval by threshold.",
     "Must", ["N-08", "N-04"], ["E4-T07", "E4-T08"], [
         ("a purchase order with the same number or the same lines as an open order", "it is saved", "the save is refused and 1 existing order is shown"),
         ("a purchase order of 2,50,000 rupees against a threshold of 1,00,000", "it is submitted", "it goes to the approval queue and cannot be sent to the supplier"),
         ("an approved order", "its lines are read", "each line links to its BOM line and the ordered quantity updates in the same transaction"),
         ("a purchase order sent to a supplier", "its price is edited", "the edit is refused and revision 2 is required")])
feat("promises", "Supplier promises and ETAs",
     "Record the acknowledgement, promised dispatch and delivery dates and every change with its effect on dependent jobs.",
     "Must", ["N-09"], ["E4-T09"], [
         ("a promised delivery moved from 10 to 17 November", "the change is saved", "the log holds old and new dates and the 3 dependent jobs are listed"),
         ("a promise 2 days from the required-by date with no confirmation", "the evaluator runs", "1 supplier delay exception is raised"),
         ("a supplier with 5 ETA changes in 30 days", "its record is read", "the count of 5 and the average slip in days are shown")])
feat("returns", "Returns and claims",
     "Damaged, short and warranty claims with credit notes and open-claim tracking.",
     "Should", ["N-08"], ["E4-T10"])
feat("bomrev", "BOM revision impact and change requests",
     "Compare old and new BOM, list affected orders and reservations before applying, and approve changes with cost and schedule effect.",
     "Should", ["N-08", "N-04"], ["E4-T11", "E4-T12"])

# ----------------------------------------------------------------------------- E5 stock and readiness
feat("grn", "Goods receipt, inspection and serials",
     "Receive against purchase order lines with partial, over and under delivery, inspect and reject with photos, and capture serial and batch numbers.",
     "Must", ["N-10"], ["E5-T01", "E5-T02", "E5-T03"], [
         ("an order of 100 panels", "60 arrive, 2 are rejected with a photo", "stock increases by 58 and the order shows 58 received of 100"),
         ("a serial number that already exists", "it is captured again", "the capture is refused and 1 earlier record is shown"),
         ("40 serial numbers scanned for a delivery of 40", "the receipt is saved", "40 serials are linked to the order line and the warranty start is empty until commissioning"),
         ("a delivery of 105 against an order of 100", "it is received", "the 5 extra units are flagged as over-delivery and need approval before stock is added")])
feat("ledger", "Stock ledger and reservations",
     "An append-only stock ledger by item, warehouse, site and status, and reservations to a project that warn on double promises.",
     "Must", ["N-10", "N-11"], ["E5-T04", "E5-T05"], [
         ("any stock movement", "it is recorded", "an entry with item, quantity, from, to, status, actor and time is appended and 0 existing entries change"),
         ("100 inverters of which 40 are reserved", "50 more are reserved to another project", "the second reservation is refused for the 10 unavailable and shows the 40 and 50 balance"),
         ("2 users reserving the last 10 units at the same moment", "both submit", "exactly 1 succeeds and 1 is refused, over 1,000 repeated runs"),
         ("stock for a project in branch A", "a user scoped to branch B reads stock", "0 rows are returned")])
feat("avail", "Material availability and shortage",
     "Per project and required-by date: stock, reserved, open orders with confirmed dates and the uncovered shortfall.",
     "Must", ["N-11"], ["E5-T06"], [
         ("a project needing 40 panels by 20 November with 10 in stock and 20 on a confirmed order for 18 November", "availability is read", "the shortfall of 10 is shown with the 3 actions: expedite, substitute, transfer"),
         ("an order with an unconfirmed date", "availability is read", "its quantity adds 0 to the covered total"),
         ("the same unit promised to 2 projects", "availability is read", "the conflict is shown on both projects, 2 of 2")])
feat("ready", "Readiness gate",
     "Ready, conditional or blocked, with reasons for material, design, permit, access, crew and customer, shown before a crew is dispatched.",
     "Must", ["N-11"], ["E5-T07"], [
         ("a job with 1 missing material line", "the gate is read", "the status is blocked and the reason names the line"),
         ("a blocked job with a crew booked", "the schedule is saved", "1 warning is shown and an override needs 1 approver and 1 reason"),
         ("a job with all 6 checks passed", "the gate is read", "the status is ready and the evidence of each check is linked"),
         ("a gate that changes from ready to blocked", "the change is detected", "1 exception is raised for the project manager within 5 minutes")])
feat("transfer", "Transfers and issue to site",
     "Move stock between warehouses and sites, issue to a crew and record consumption and returns.",
     "Should", ["N-10"], ["E5-T08"])

# ----------------------------------------------------------------------------- E6 cost and margin
feat("budget", "Budget, commitments and actual cost",
     "Budget by category from the baseline, with purchase orders as commitments and bills and expenses as actual cost, never counted twice.",
     "Must", ["N-12"], ["E6-T01", "E6-T02"], [
         ("a budget of 100 and a purchase order of 40", "the project cost view is read", "committed is 40, actual is 0 and remaining budget is 60"),
         ("the supplier bill of 40 against that order", "it is recorded", "committed falls to 0, actual is 40 and the total cost stays 40, not 80"),
         ("a payment of 40 to the supplier", "it is recorded", "the liability is settled and cost does not change"),
         ("10,000 random event sequences", "the cost ledger is checked", "0 sequences count a rupee twice")])
feat("margin", "Forecast margin and margin floor",
     "Contract value less forecast final cost, the variance from baseline with its drivers, and a margin floor that raises exceptions.",
     "Must", ["N-12", "N-02"], ["E6-T03", "E6-T04"], [
         ("a contract of 500,000 rupees, actual 200,000 and 250,000 still forecast", "forecast margin is read", "it is 50,000 rupees, 10%, and the baseline variance is shown"),
         ("a margin floor of 12% and a forecast of 9%", "the evaluator runs", "1 exception is raised with the 3 largest drivers named"),
         ("a driver of transport cost above budget", "it is opened", "all cost lines behind it are listed and total the driver amount with a difference of 0 paise"),
         ("a forecast at the commissioning milestone", "the job closes", "2 values, forecast and realised margin, are stored for the accuracy metric")])
feat("bills", "Supplier bills and duplicate guard",
     "Supplier bills, due dates, payment approval and a guard that flags probable duplicates.",
     "Should", ["N-12", "N-15"], ["E6-T05", "E6-T06"])
feat("expenses", "Field expenses",
     "Labour, transport, crane and other costs captured from the phone with a receipt photo.",
     "Should", ["N-12", "N-14"], ["E6-T07"])

# ----------------------------------------------------------------------------- E7 billing and collections
feat("billplan", "Milestone billing plan and invoice records",
     "A billing plan from the baseline milestones and records of invoices entered or imported with their Tally reference, kept unchangeable.",
     "Must", ["N-13"], ["E7-T01", "E7-T02"], [
         ("a baseline with 4 milestones", "the billing plan is created", "4 plan lines with percentage and amount exist and sum to the contract value to the paise"),
         ("an invoice record", "a user edits its amount", "the edit is refused and 1 linked credit-note record is the only correction"),
         ("an invoice record with taxable value, rate and tax split", "it is saved", "the parts sum to the total with a difference of 0 paise or the save is refused"),
         ("a milestone reached with no invoice after 7 days", "the evaluator runs", "1 unbilled-milestone exception is raised")])
feat("receipts", "Receipts, ageing and the blocked-by chain",
     "Receipts by cash, cheque and bank transfer, retention and disputed amounts apart, ageing by band, and the chain from a late invoice to the utility stage behind it.",
     "Must", ["N-13", "N-03"], ["E7-T03", "E7-T04", "E7-T05"], [
         ("an invoice of 100,000 rupees and a receipt of 60,000", "the ledger is read", "the balance is 40,000 and the invoice shows partly paid"),
         ("a retention of 5% and a disputed 10,000", "ageing is read", "both are shown in their own columns and excluded from overdue"),
         ("an invoice 45 days overdue whose final milestone waits on commissioning and an open utility query", "its blocked-by chain is opened", "3 links are shown in order with owners"),
         ("a receipt entered twice with the same reference", "it is saved", "the second is refused as a duplicate and 1 receipt exists")])
feat("collect", "Collections board and reminders",
     "Overdue by age, promise-to-pay date, who calls whom today, and reminders on due dates.",
     "Should", ["N-13"], ["E7-T06"])

# ----------------------------------------------------------------------------- E8 field
feat("siteapp", "Site app: installable, offline and conflict-safe",
     "An installable web app for site work that queues updates offline, shows queued and synced state and never overwrites a conflict silently.",
     "Should", ["N-14"], ["E8-T01", "E8-T02", "E8-T03"])
feat("sitework", "Site daily plan, checklist, photos and blockers",
     "Today's jobs, geo check-in, checklist, photos, installed quantities, blockers and material requests.",
     "Should", ["N-14"], ["E8-T04"])
feat("calendar", "Crew and subcontractor calendar",
     "Crews by day with clash and unready-site warnings, and subcontractor scope and completion approval.",
     "Should", ["N-14"], ["E8-T05"])
feat("punch", "Quality checks and punch list",
     "Quality checks, rework tasks and serial scan at install.",
     "Should", ["N-14"], ["E8-T06"])
feat("handover", "Commissioning and handover pack",
     "Test records, as-built documents, customer acceptance, warranty start and a handover pack built from current documents.",
     "Should", ["N-14", "N-19"], ["E8-T07"])

# ----------------------------------------------------------------------------- E9 integrations
feat("email", "Email sending",
     "Send requests, orders and reminders by email through a provider behind the message-sender port, with templates.",
     "Must", ["N-08", "N-06"], ["E9-T01"], [
         ("a request for quotation", "it is sent", "1 email per supplier leaves with the private link and the send is logged with 0 secrets in the log"),
         ("the sending domain without SPF, DKIM or DMARC", "the setup check runs", "the 3 missing records are listed and sending is held"),
         ("a send that fails and is retried", "it eventually succeeds", "the supplier receives exactly 1 email")])
feat("export", "Export everything",
     "Export every record, attachment and history in documented CSV and JSON at any time, as an audited job.",
     "Must", ["N-16"], ["E9-T02"], [
         ("a seeded company with 25 projects", "a full export is requested", "it completes in 24 hours or less and holds every table, attachment and history with a checksum that verifies"),
         ("a cell beginning with = in the data", "it is exported to CSV", "it is prefixed so it opens as text in 100% of such cells"),
         ("a user without the export permission", "they request an export", "the request is refused and 1 denied entry is audited"),
         ("a download link", "it is used after 5 minutes", "it is rejected")])
feat("tally", "Tally sync",
     "Export vouchers and bills, import ledger and payment status, queue unmatched records and show last sync time and errors.",
     "Should", ["N-15"], ["E9-T03", "E9-T04", "E9-T05"])
feat("whatsapp", "WhatsApp messaging",
     "Supplier, crew and customer messages through a business provider with per-contact opt-in and approved templates.",
     "Should", ["N-06", "N-09"], ["E9-T06"])

# ----------------------------------------------------------------------------- Later (tasks written when promoted)
feat("survey", "Site survey capture", "Configurable survey form with photos and location, offline.", "Later", ["N-18"], [])
feat("estimate", "Estimate and price book", "Versioned price book, margin rules and subsidy slabs that block quotes below the margin floor.", "Later", ["N-18"], [])
feat("proposal", "Proposal versions", "Branded proposals where acceptance records the exact revision.", "Later", ["N-18"], [])
feat("leads", "Leads and channels", "Capture, duplicate catch, response timer and pipeline for enquiries.", "Later", ["N-18"], [])
feat("assets", "Installed asset register", "Serials, commissioning data and warranty dates per site.", "Later", ["N-19"], [])
feat("tickets", "Service tickets and AMC", "Tickets with warranty check and SLA, visits, parts and AMC renewals.", "Later", ["N-19"], [])
feat("tracking", "Customer tracking link and portal", "A private link showing project stage, documents and dues.", "Later", ["N-18"], [])
feat("dealers", "Dealer accounts and credit (Trade pack)", "Partner accounts, price lists, credit checks and dispatch for selling to other installers.", "Later", ["N-08"], [])
feat("invoicing", "GST invoice issuing and payment links", "Issue tax invoices and collect through hosted payment links, subject to decision Q-03.", "Later", ["N-13"], [])
feat("api", "API and webhooks", "Documented events and safe retries for projects, orders, receipts and stage changes.", "Later", ["N-15"], [])
feat("aiextract", "AI extraction", "Read quotes, bills and challans into suggestions that a person confirms.", "Later", ["N-08"], [])
