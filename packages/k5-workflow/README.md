# @gx/k5-workflow

Workflow engine: definitions and instances, guards, stage requirements, actions, SLA timers and approvals as data.

- Plan: [K5 brief](../../docs/plans/001-foundation/K5-workflow.md), wave 4. Layer L0 module.
- Register id: `k5-workflow` in [packages/register.json](../register.json).
- Status: skeleton from K0-T02. Capabilities, ports, events and extension points arrive with the tasks in the brief and are listed here as they ship.

## Public API

One file, `src/index.ts`, exported as `@gx/k5-workflow`. Other packages import only that name: deep imports are blocked by the `exports` map and by `pnpm check:imports`.

| Export | What it is |
|---|---|
| `MODULE_ID` | This package's register id, `k5-workflow` |

## Depends on

`@gx/core`

## Tests

```
pnpm vitest run --project k5-workflow
```
