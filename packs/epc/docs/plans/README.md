# EPC pack: plan and agent playbook

The pack plan for the solar EPC owner control tower. Scope and acceptance criteria are in [the pack PRD](../prd/01-prd.md); the work queue is [TASKS.md](TASKS.md); the mapping onto the foundation and the list of generic capabilities the pack builds first are in [foundation-map.md](../foundation-map.md); domain rules and sources are in [domain-notes.md](../domain-notes.md). Execution rules (roles, ready and done, start prompts, escalation) are the repository's [plan playbook](../../../../docs/plans/README.md) and apply here unchanged; this file adds the pack-specific sequencing.

## Numbers

- 68 features: 38 Must, 19 Should, 11 Later (no tasks until promoted); 145 acceptance criteria
- 96 tasks in 10 lanes; 13 are security-critical (S3: threat model first, blocking security review)
- Pack waves: A 48 tasks, B 9, C 23, D 16
- 8 milestones and 5 gates (G0 to G4)

## Sequencing with the foundation

The pack uses only the foundation's public APIs, so it can start as soon as the ports and fakes exist and swap in real adapters as waves land. The pack never waits for a whole wave: a task starts when the foundation features it uses (listed per task) are merged.

| Pack wave | Starts when | What runs | Foundation |
|---|---|---|---|
| A | Foundation wave 0 done (ports, fakes, toolchain); tables from wave 1 (tenancy); outbox and jobs from wave 2 | Pure domain code that needs no identity or configuration: money and calendar libraries, import engine, BOM and stock state machines, exception evaluator, cost ledger, demo seed and demo views | Waves 0 to 2 |
| B | Foundation wave 3 (configuration, custom fields, condition language, bundles) | Configuration bundle, company setup, project templates, stage templates, exception rules as data | Wave 3 |
| C | Foundation wave 4 (identity, roles, workflow, approvals, SLA timers) | Roles and approval policies, stage tracker on workflow, approval queue, escalation, readiness gate overrides, site app sign-in | Wave 4 |
| D | Foundation wave 5 (files, privacy desk, retention, erasure) | Evidence and document attachments, goods-receipt photos, handover pack, erase and export handlers, export everything | Wave 5 |

Phase 0 (validate) needs no foundation and starts now: owner conversations, real sheets, definitions and the paid-pilot ask. It decides whether anything below ships.

## Milestones and what unlocks them

| Milestone | Outcome | Tasks | Pack waves | Earliest real-data demo |
|---|---|---|---|---|
| M-01 | A pitch demo opens on the owner home with sample data and shows exceptions, utility ageing, cash blocked and margin | 6 | A | foundation wave 2 done |
| M-02 | An owner brings a project sheet in, fixes every row error and sees baselined projects | 13 | ABCD | foundation wave 5 done |
| M-03 | Every job carries its utility stage, owner, age, documents and evidence, and late stages escalate | 12 | ACD | foundation wave 5 done |
| M-04 | The owner opens one exceptions list and decides from it (pilot control loop) | 11 | ABC | foundation wave 4 done |
| M-05 | A pilot runs material from BOM to receipt to a readiness gate on a live job | 19 | ACD | foundation wave 5 done |
| M-06 | Forecast margin and receivables reconcile to source documents | 12 | ABCD | foundation wave 5 done |
| M-07 | Field updates, Tally sync and collections work on live jobs | 23 | ABCD | foundation wave 5 done |
| M-08 | Later features are promoted only when paying pilots ask for them twice | 0 | - | foundation wave 0 done |

## Honest timing

- A pilot on real customer data needs identity, workflow, files and the privacy desk, so the first real pilot is after foundation wave 5. Before that, owners see the demo and a sample-data walkthrough (milestone M-01) and send real sheets for import testing (M-02).
- Foundation wave 4 holds identity, entitlements and workflow. The pack needs identity and workflow first and entitlements last (decision Q-12): split wave 4 that way, then run wave 5 straight after, so pilots do not wait for plan limits.
- The pack builds generic capabilities first (exceptions, tasks, import, stock ledger, cost ledger, message adapters). They are marked as extraction candidates in [foundation-map.md](../foundation-map.md); they move to a shared utilities layer only when a second vertical needs them (rule of two).

## Pack rules

1. No work without an F id in the pack PRD. New scope is a change request in `packs/epc/docs/prd/changes/`.
2. Foundation packages are never edited for the pack. A missing capability is a foundation defect: stop and raise it (change request on the foundation PRD), or build it inside the pack and record it in the foundation map.
3. No solar words in foundation packages; the boundary and industry-word lints run on every merge.
4. Stage lists, document checklists, thresholds, rates, flags and labels are data in the configuration bundle, never code.
5. Every figure on the owner home opens its records and says how fresh it is.
6. A Must feature needs its sourced analysis file (gx-analyst) before its first task starts.

## Commands

```
python3 tools/plangen/epc_gen.py                       regenerate PRD, roadmap, register, briefs and foundation map
python3 .claude/gx/bin/prdtool.py lint --root packs/epc
python3 .claude/gx/bin/prdtool.py check --root packs/epc
python3 .claude/gx/bin/prdtool.py trace --root packs/epc
```

## Briefs

- [E0 Pack core, roles, configuration, demo and privacy handlers](E0-core.md)
- [E1 Import, customers, handoff and baseline](E1-projects.md)
- [E2 Utility and subsidy tracker](E2-utility.md)
- [E3 Exceptions, owner home, approvals and tasks](E3-control.md)
- [E4 BOM, suppliers and procurement](E4-materials.md)
- [E5 Receiving, stock and readiness](E5-stock.md)
- [E6 Cost and margin](E6-cost.md)
- [E7 Billing records and collections](E7-billing.md)
- [E8 Site app and handover](E8-field.md)
- [E9 Email, export, Tally and WhatsApp](E9-integrations.md)
