# Plan 001: Foundation (kernel L0)

Build the reusable, multi-tenant, extractable foundation: nine modules in ten packages, 119 tasks, six waves. Architecture is in [docs/adr](../../adr) and [module-catalog](../../architecture/module-catalog.md). The full map, with diagrams, is in the Claude Doc "Foundation Map: Kernel Layer L0" (https://claude.ai/artifact/6Nm2jDxHPkAKvJfrM3WiCP).

Status: ADR-0001 to ADR-0006 are Accepted (2026-11-04). Wave 0 can start. Decisions 4, 6 and 7 below stay open; 5 is a direction pending the checks in ADR-0006.

## Waves and gates

| Wave | Modules | Tasks | Gate (nothing in the next wave starts on a red gate) |
| --- | --- | --- | --- |
| 0 | [K0 Core and toolchain](K0-core.md) | 14 | CI green on main; sandbox host boots from the foundation alone |
| 1 | [K1 Tenancy and isolation](K1-tenancy.md) | 12 | Tenant matrix and pool-leak test pass in CI |
| 2 | [K6 Event bus and jobs](K6-events.md), K7a audit log ([K7](K7-audit-privacy.md)) | 11 + 8 | Kill test loses no event; audit row commits with the change |
| 3 | [K4 Config and custom fields](K4-config.md) | 12 | Hostile expr input cannot loop; applying a bundle twice changes nothing |
| 4 | [K2 Identity and access](K2-identity.md), [K3 Entitlements](K3-entitlements.md), [K5 Workflow](K5-workflow.md) | 18 + 11 + 13 | No privilege escalation; a connector signs in; concurrent transitions conflict cleanly |
| 5 | [K8 Files and vault](K8-files.md), K7b privacy desk ([K7](K7-audit-privacy.md)) | 12 + 8 | A seeded tenant exports completely and deletes cleanly |

Inside a wave modules build in parallel, except K7a, which follows K6. Wave 4 holds 42 tasks and is the one to split between people.

## Conventions

- One task is about one working session (size S or M). Split anything larger before starting.
- `main` stays releasable. User-visible change ships behind a flag.
- Migrations are expand-only and namespaced per package (k1_, k2_ and so on); rollback is a forward fix.
- A task id is its commit scope: `feat(K1-T03): ...`.
- Tick the box in the module brief in the same change that completes the task.

## Definition of done (every task)

- Its done-when and tests pass; any new port has a fake and a contract suite.
- The tenant matrix is green, including any new table.
- The module manifest is updated (permissions, events, extension points, tools).
- The public-API diff is clean, or the semver bump is in the same change.
- The migrate-from-previous check passes.
- `privacycheck` is clean; new fields carry a data classification; new personal data has an eraser and exporter handler.
- README and changelog of the module are updated.

## Extraction drill

Run once, at the end of wave 5, using the sandbox host (K0-T12). EPC-first (2026-11-04): the boundary lint and the no-industry-words check run on every merge, which keeps later cherry-picking cheap; the full drill waits until the foundation is complete. Steps:

1. Copy the foundation packages into an empty repo that holds only the sandbox host.
2. Install, migrate from empty to head, boot; health is ok and the registered modules are listed.
3. Run every contract suite, the tenant matrix and the boundary lint there.
4. Add one throwaway module from a different vertical (an entity, a custom field, a workflow, a permission) using manifests only.
5. Pass means zero foundation edits and zero industry words flagged. Any edit is a foundation defect, fixed before the next wave.

## Decisions needed

| # | Decision | Lean | Blocks |
| --- | --- | --- | --- |
| 1 | Stack and hosting | Decided: ADR-0006 (TypeScript, Next.js on Vercel, Supabase Postgres, Mumbai) | done |
| 2 | Repo shape | Decided: monorepo (ADR-0006) | done |
| 3 | Accept ADR-0001 to ADR-0005 | Accepted 2026-11-04 | done |
| 4 | Second vertical for the rule of two | Deferred: EPC only for now; a later vertical cherry-picks | none |
| 5 | OAuth server: build or delegate | Direction: delegate the protocol to Supabase Auth behind the identity port; confirm checks first | K2-T15 |
| 6 | Workflow engine: in-house or adopt | In-house | K5-T01 |
| 7 | Licence and IP model for client custom builds | Your call plus counsel | K3-T09 |

Record each answer in `.claude/memory/DECISIONS.md` and, for 1, 2, 5 and 6, as an ADR.

<!-- gen:agent-exec -->
## Agent execution

Tasks now carry feature, level, lane, agents, skills, security level, rollback and human gates. Execution rules, roles and start prompts are in [the playbook](../README.md); the full queue is [TASKS.md](../TASKS.md); scope and acceptance criteria are in [the PRD](../../prd/01-prd.md). The design system has its own plan: [002-design-system](../002-design-system/README.md).

Human gates (an agent stops and asks): K2-T15 confirm the Supabase Auth checks in ADR-0006, K4-T06 custom-field storage ADR, K3-T09 licence and IP.
<!-- /gen:agent-exec -->
