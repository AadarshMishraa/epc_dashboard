# Plans and agent playbook

How work is planned, assigned and executed. The EPC pack plan is in [packs/epc/docs/plans/README.md](../../packs/epc/docs/plans/README.md). Scope and acceptance criteria are in [docs/prd/01-prd.md](../prd/01-prd.md); the full work queue is [TASKS.md](TASKS.md); per-module briefs are in [001-foundation](001-foundation/README.md) and [002-design-system](002-design-system/README.md).

## Numbers

- 67 features (50 Must, 13 Should) with 170 acceptance criteria
- 133 tasks: 119 foundation and 14 design system
- 42 tasks are security-critical (S3) and need a threat model and a blocking security review
- 12 dependency levels; lanes are packages
- 8 milestones

## The chain

Goal (G) to need (N) to feature (F) to milestone (M) to task. A task is the unit an agent executes: one working session, size S or M, one lane, one branch, one pull request. No work without an F id (gx-delivery-pipeline).

## Roles

| Role | Agent | Does |
|---|---|---|
| Decider | Aadarsh | Answers the decisions, accepts ADRs, accepts features at gates |
| Planner | gx-planner | Drafts ADRs and options for human-gated tasks; splits a task that is too big |
| Builder | gx-implementer | Builds one task from its brief, test first, inside one lane |
| Tests | gx-qa-engineer | Writes the negative, property, chaos, contract and matrix tests named in the brief |
| Security | gx-security-reviewer | Threat-models S3 tasks before build; blocks merge on S3; reviews S2 at the module gate |
| Staff review | gx-staff-reviewer | Reviews every M task for design, boundaries and public API |
| UX review | gx-ux-reviewer | Reviews every UI task against docs/design/design-system.md |
| Analyst | gx-analyst | Writes the sourced feature analysis for each Must feature before its first task starts |
| Map | gx-cartographer | Refreshes the code map at the end of each wave |

## Ready, then done

A task is **ready** when: its needs are merged, the decision gates it names are answered, its feature has an analysis file (Must features), and an S3 task has a threat model written by gx-security-reviewer in the task branch or pull request description.

A task is **done** when: the done-when and tests in its brief pass; the definition of done in [001-foundation/README.md](001-foundation/README.md) holds; the reviewers named in the brief approved; security findings of Critical or High are closed; the box is ticked in the brief; and STATUS is updated if the task is in the current milestone.

## Parallel work

- Work in lanes: one agent per package at a time. Different lanes run in parallel in separate worktrees.
- Level is the depth in the dependency graph. Start the lowest-level ready tasks first; every task at a level can start once its own needs are merged.
- Shared files (the workspace manifest, the module registry and migrations ledger) change in small, separate pull requests merged quickly to avoid conflicts.
- Wave 4 has three lanes (K2, K3, K5): run them as three agents.

## Start prompt for a build agent

```
You are gx-implementer. Execute task <PLAN-ID> (<T-ID>) from docs/plans/<module brief>.
1. Read the brief entry, its feature and acceptance criteria in docs/prd/01-prd.md, the module brief header, docs/guidelines/development-guidelines.md and docs/guidelines/security-guidelines.md.
2. Confirm every need is merged and every human gate is answered. If not, stop and report what is missing.
3. Create branch feat/<PLAN-ID>. Write the failing tests first, then the code, inside your lane only.
4. Satisfy the security line of the brief and the module security baseline. S3: do not start until the threat model exists.
5. Run the checks in the definition of done. Tick the box. Open a pull request titled feat(<PLAN-ID>): <summary> and list reviewers from the brief.
6. If the task needs a change outside your lane or to a public API, stop and ask instead of widening scope. Never edit generated files by hand.
```

## Start prompt for a review agent

```
You are <gx-staff-reviewer | gx-security-reviewer | gx-ux-reviewer>. Review the pull request for <PLAN-ID>.
Check the done-when, tests, definition of done and the security line of the brief. For S3 verify the threat model rows have controls and tests.
Report findings as Critical, High, Medium or Low with file and line. Approve only when no Critical or High remains.
```

## Escalate to Aadarsh when

A decision gate is open; a task needs a public-API change that breaks a consumer; a Critical or High finding cannot be closed in the task; the estimate doubles; or two agents need the same file.

## Change control

New scope is a change request in docs/prd/changes/ with a new or changed F id. Task and feature catalogues change in tools/plangen, then `python3 tools/plangen/gen.py plans` regenerates the register and briefs (ticked boxes are kept) and `python3 .claude/gx/bin/prdtool.py lint` and `check` must stay clean.
