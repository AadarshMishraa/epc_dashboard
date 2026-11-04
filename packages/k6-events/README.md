# @gx/k6-events

Event bus and jobs: transactional outbox, dispatch with retries and dead letters, job queue with tenant fairness and a scheduler.

- Plan: [K6 brief](../../docs/plans/001-foundation/K6-events.md), wave 2. Layer L0 module.
- Register id: `k6-events` in [packages/register.json](../register.json).
- Status: skeleton from K0-T02. Capabilities, ports, events and extension points arrive with the tasks in the brief and are listed here as they ship.

## Public API

One file, `src/index.ts`, exported as `@gx/k6-events`. Other packages import only that name: deep imports are blocked by the `exports` map and by `pnpm check:imports`.

| Export | What it is |
|---|---|
| `MODULE_ID` | This package's register id, `k6-events` |

## Depends on

`@gx/core`

## Tests

```
pnpm vitest run --project k6-events
```
