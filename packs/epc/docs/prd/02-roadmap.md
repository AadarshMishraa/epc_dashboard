# Roadmap

Dates stay TBD until each Must feature has its analysis and size. A phase closes at its gate, not on a date. The pack builds in step with the foundation: see docs/plans/README.md for the wave sequencing.

## Phases and gates
| Phase | Name | Gate | Gate criteria | Target date |
|-------|------|------|---------------|-------------|
| P0 | Validate (no code, starts now) | Gate 0 | 8 to 10 owner conversations; 5 real sheets collected; definitions drafted; at least 3 companies agree to a paid pilot or defined paid trial; one repeated high-cost pain confirmed | TBD |
| P1 | Demo and import | Gate 1 | Demo shown to 5 owners with the cold-viewer test passed; import of 3 real sheets with all row errors explained | TBD |
| P2 | Control loop | Gate 2 | Pilot owners open the exceptions list and utility tracker weekly instead of their sheet; stage accuracy 95% or more on sampled jobs | TBD |
| P3 | Material loop | Gate 3 | A pilot runs a live job through BOM, order, receipt and readiness with no parallel spreadsheet | TBD |
| P4 | Margin, cash and field | Gate 4 | Forecast margin and readiness reconcile to source documents; field updates used on live jobs; 3 pilots convert to paid | TBD |
| P5 | Launch and operate | - | Two weeks without a severity-1 issue; support runbook handed over; change control for new scope | - |

## Milestones
A milestone is an outcome Aadarsh can verify, one demoable every 1 to 2 weeks of build.

| ID | Outcome the client can verify | Features | Date | Phase | Demo script (5 steps max) |
|----|-------------------------------|----------|------|-------|----------------------------|
| M-01 | A pitch demo opens on the owner home with sample data and shows exceptions, utility ageing, cash blocked and margin | F-05, F-01, F-02 | TBD | P1 | open the demo tenant; read the exceptions list; open cash blocked and follow one number to its records; switch to dark; show nothing is typed in |
| M-02 | An owner brings a project sheet in, fixes every row error and sees baselined projects | F-04, F-08, F-09, F-10, F-11, F-03 | TBD | P1 | upload a sheet with 3 bad rows; read the error report; fix and re-import twice; open a project with its baseline; try an action as a user without permission and see the denial |
| M-03 | Every job carries its utility stage, owner, age, documents and evidence, and late stages escalate | F-12, F-13, F-14, F-15, F-16, F-54, F-23, F-25 | TBD | P2 | load the state template; move a job to a query stage; watch the clock pass its limit; see the task and escalation; open the cash-blocked list grouped by blocker |
| M-04 | The owner opens one exceptions list and decides from it (pilot control loop) | F-18, F-19, F-20, F-21, F-22, F-24 | TBD | P2 | seed 5 causes; show 5 exceptions not 50; open the home; drill from a number to a record; approve one PO from the queue; resolve and verify one exception |
| M-05 | A pilot runs material from BOM to receipt to a readiness gate on a live job | F-29, F-30, F-31, F-32, F-33, F-34, F-37, F-38, F-39, F-40, F-07 | TBD | P3 | request quotes for 6 BOM lines from 3 suppliers; compare landed cost; raise and approve a PO; receive partly with one rejection; see shortfall; watch the gate change from blocked to ready |
| M-06 | Forecast margin and receivables reconcile to source documents | F-42, F-43, F-46, F-47, F-55, F-06 | TBD | P4 | open a job; read budget, commitments, actuals and forecast margin; record a milestone invoice and a part receipt; see ageing and the blocked-by chain; export everything and verify the checksum; run an erasure request |
| M-07 | Field updates, Tally sync and collections work on live jobs | F-49, F-50, F-51, F-52, F-53, F-56, F-57, F-44, F-45, F-48, F-27, F-28, F-26, F-17, F-35, F-36, F-41 | TBD | P4 | work a job offline on a phone and sync it; see a conflict surfaced; sync a bill to Tally and reconcile one mismatch; send a reminder; read the Monday digest |
| M-08 | Later features are promoted only when paying pilots ask for them twice | F-58, F-59, F-60, F-62, F-63, F-64, F-65, F-66, F-67, F-68, F-61 | TBD | P5 | review the pilot request log; promote one Later feature through a change request; write its tasks |
