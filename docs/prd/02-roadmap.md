# Roadmap

Dates stay TBD until the feature analysis has sized every feature (S, M, L). A phase closes at its gate, not on a date.
This roadmap covers the foundation and design system only. The EPC pack has its own PRD in packs/epc/docs/prd and enters at its P2.

## Phases and gates
| Phase | Name | Gate | Gate criteria | Target date |
|-------|------|------|---------------|-------------|
| P0 | Discovery | Gate 0 | PRD v1.0 signed; decisions Q-01 to Q-03 answered; feature analysis reviewed; roadmap approved | TBD |
| P1 | Foundation | Gate 1 | Milestones M-01 to M-08 demonstrated; extraction drill passes with 0 foundation edits; 0 open Critical or High findings | TBD |
| P2 | Vertical build | Gate 2 | First vertical pack passes its Must criteria on the foundation (tracked in the vertical PRD) | TBD |
| P3 | Harden | Gate 3 | Load, security, accessibility and privacy drills pass; migration rehearsed; rollback written | TBD |
| P4 | Launch | Gate 4 | Two weeks live with no severity-1 issue; support runbook handed over | TBD |
| P5 | Operate | - | Continuous improvement under change control | - |

## Milestones
A milestone is an outcome Aadarsh can verify, one demoable every 1 to 2 weeks of build.

| ID | Outcome the client can verify | Features | Date | Phase | Demo script (5 steps max) |
|----|-------------------------------|----------|------|-------|----------------------------|
| M-01 | Foundation core boots: the sandbox host runs from the foundation alone and CI gates are green | F-01, F-02, F-03, F-04, F-05, F-06 | TBD | P1 | run the one-command environment; boot the sandbox and read the health output; break an import rule and watch CI fail; run all contract suites against the fakes |
| M-02 | Tenants are isolated by the database and this is proven in CI | F-07, F-08, F-09, F-10, F-11, F-12, F-13 | TBD | P1 | provision two tenants; query across them and get 0 rows; run the pool-leak test; suspend a tenant and watch calls fail; open a support session and read its audit trail |
| M-03 | Events are never lost and every change is audited | F-14, F-15, F-16, F-17, F-18, F-19, F-20, F-21, F-22 | TBD | P1 | kill the dispatcher mid-batch and show 0 lost events; send a poison event to the dead-letter queue and replay it; change a record and show its audit row; alter a row and let the verifier name it |
| M-04 | A tenant reshapes its business without code | F-23, F-24, F-25, F-26, F-27, F-28, F-29 | TBD | P1 | add a custom field and a lookup list; change a label in Hindi; apply a config bundle twice and show 0 changes; feed a hostile expression and show it rejected |
| M-05 | People sign in securely and an AI assistant connects with the user's own permissions | F-30, F-31, F-32, F-33, F-34, F-35, F-36, F-37, F-38, F-39 | TBD | P1 | invite a user and enrol MFA; revoke a device; show a deny with a reason; connect Claude and ChatGPT connectors and call one tool each; show the audit actor as user via client |
| M-06 | Plans and modules control access and workflows run on any record | F-40, F-41, F-42, F-43, F-44, F-45, F-46, F-47, F-48, F-49, F-50 | TBD | P1 | disable a module for one tenant; hit a plan limit; run a record through an approval with a guard and an SLA; submit 2 concurrent transitions and show 1 conflict |
| M-07 | Privacy duties and files work end to end | F-51, F-52, F-53, F-54, F-55, F-56, F-57, F-58, F-59, F-60, F-61 | TBD | P1 | grant and withdraw consent; run an erasure request across 5 modules; export and delete a seeded tenant; upload a file and download it with a signed URL; open a breach incident and read both clocks |
| M-08 | One accessible design system in light and dark themes | F-62, F-63, F-64, F-65, F-66, F-67 | TBD | P1 | open the reference page in both themes; operate every menu by keyboard; run the contrast and colour-budget checks; show a tenant accent rejected for low contrast |
