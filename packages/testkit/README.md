# @gx/testkit

Test kit: tenant matrix runner, adapter contract harness, frozen clock, fixtures and pool-leak helper.

- Plan: [K0 brief](../../docs/plans/001-foundation/K0-core.md), wave 0. Support package in the core lane (not a module).
- Register id: `testkit` in [packages/register.json](../register.json).
- Status: skeleton from K0-T02. Capabilities, ports, events and extension points arrive with the tasks in the brief and are listed here as they ship.

## Public API

One file, `src/index.ts`, exported as `@gx/testkit`. Other packages import only that name: deep imports are blocked by the `exports` map and by `pnpm check:imports`.

| Export | What it is |
|---|---|
| `MODULE_ID` | This package's register id, `testkit` |

## Depends on

`@gx/core`

## Tests

```
pnpm vitest run --project testkit
```
