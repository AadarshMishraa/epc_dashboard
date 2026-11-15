---
id: CR-001
title: Commercial approval track, receipt deductions, supplier advances, complaint log and asset register
status: approved
requested: 2026-11-13
decided: 2026-11-13
impact: scope +4 features and 1 promoted (25 acceptance criteria, 8 tasks); no date moves because no pack feature has started
---
# CR-001 Commercial approval track, receipt deductions, supplier advances, complaint log and asset register

Requested by: Aadarsh Mishra, after the plan-against-industry comparison of 2026-11-12 (suggestions 1 to 3)   Type: add and change
What is asked: add the pieces the comparison found missing, as data and small features on the existing foundations, without touching any foundation package:

1. **F-69 Commercial approval track** (Should, new): a stage template for commercial jobs per state, and a warning when the planned system is larger than the sanctioned load or the state's net-metering limit. Tasks E2-T10, E2-T11.
2. **F-70 Receipt deductions and certificate follow-up** (Must, new): a business customer pays net of a deduction; the deduction settles the invoice, is never cash, is never overdue, and is followed up until its certificate arrives. Tasks E7-T07, E7-T08.
3. **F-71 Supplier advances** (Must, new): money paid before the bill is held apart from cost, applied when the bill arrives, refunded when the order is cancelled, and shown as exposure per supplier. Tasks E6-T08, E6-T09.
4. **F-62 Installed asset register** (Later to Should, promoted) and **F-72 Complaint log and reply clock** (Should, new): the minimal service record that each subsidised job needs for its maintenance duty and complaint window. Tasks E8-T08, E8-T09. Tickets and AMC (F-63) stay Later.

Why: new needs N-22 (commercial approvals, Should), N-23 (deductions and advances, Must) and N-24 (service record and complaint deadline, Should). The pack PRD targets mid-size and commercial EPCs (R-01), but the plan was written around the residential scheme flow. Without F-70 a business customer's invoice shows as overdue for money already settled by deduction (trust risk R-08). Without F-71 the cost ledger has no place for a payment that comes before a bill, which breaks the rule of never counting a rupee twice (domain rule 3).
IDs touched: new F-69, F-70, F-71, F-72, N-22, N-23, N-24, X-09, Q-13, Q-14; changed F-62 (priority Later to Should, milestone M-08 to M-07, 4 acceptance criteria written, serves N-24 as well as N-19); milestone feature lists of M-03, M-06, M-07 and M-08.
Defect or change? Change. No existing acceptance criterion fails; these are gaps in scope.
Impact: scope as listed above (features 68 to 72: Must 38 to 40, Should 19 to 22, Later 11 to 10; acceptance criteria 145 to 170; tasks 96 to 104, of which 7 are size M and 1 is size S, none security-critical S3); dates none, because every pack date is TBD and no feature has started; cost 8 session-sized tasks; risk Low for the code, Medium for the data (see below). Generated task labels (T-nnn) moved because new tasks sit inside their modules; no task had started and no F-id, N-id or E-id changed.
Options considered: (a) include everything now as data and small features (chosen); (b) wait for pilot owners to ask, which risks a wrong receivables figure and a wrong cost view in the first commercial pilot; (c) only document the gaps, which leaves the plan as it was.
Decision: approve by Aadarsh Mishra on 2026-11-13 (instruction in the working session: "now include the missing pieces as per suggestion"). Reverse by a later change request.
After approval: done by editing the catalogue in tools/plangen (epc_features.py, epc_tasks.psv, epc_project.py, epc_gen.py) and running `python3 tools/plangen/epc_gen.py`; the PRD tables got new rows and nothing was renumbered; the roadmap, traceability, briefs, TASKS and pack STATUS are regenerated; the data inventory has a complaints row.

## What stays unverified (all sourced from search summaries; no primary page was opened)

- **Deduction types, rates and certificates (Q-13).** The build ships a deduction-type list with no rates. An accountant fills it. The rate check only runs where a rate is configured. The example figures in the acceptance criteria (2,000 on 100,000; 2% as test data) test the arithmetic, not a tax rule.
- **Commercial track stages, sanctioned-load rule and net-metering limit (E2-T10).** Stage lists and limits are marked unverified, built from public information for the same two states as E2-T02, and the design partner confirms or replaces them. The 150 kW against 100 kW case comes from a search summary of utility practice.
- **Complaint window (Q-14).** The 15-day figure and whether it counts calendar or working days, and from when, are not confirmed. Both are data; the build default is the stricter reading (calendar days from the date received).
- **Supplier advances.** That suppliers ask for payment before dispatch is an inference. The owner interviews of refinement test it. If they do not, F-71 can be deferred without touching anything else.

## Not included (still leads in `.claude/memory/IMPROVEMENTS.md`)

R14 supplier MSME flag and 45-day warning; R15 liquidated damages, bank guarantees and performance guarantee; R17 lender as a payer and loan tranches; R18 a "seen, not stored" checklist item; R19 the stale e-way bill reference in `docs/compliance/register.md`. None was in the three suggestions. X-09 records that tax the company deducts from its own suppliers stays in Tally.

## Before the first task of each new Must feature starts

Rule 6 of the pack plan: F-70 and F-71 each need a sourced analysis file (gx-analyst) before E7-T07 and E6-T08 start. Not written yet. `prdtool.py trace --root packs/epc` lists them among the gaps.
