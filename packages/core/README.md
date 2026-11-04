# @gx/core

Shared contracts: context, ids, errors, Result, Clock and the core ports with in-memory fakes. No I/O and no dependencies.

- Plan: [K0 brief](../../docs/plans/001-foundation/K0-core.md), wave 0. Layer L0 module.
- Register id: `core` in [packages/register.json](../register.json).
- Status: skeleton from K0-T02. Capabilities, ports, events and extension points arrive with the tasks in the brief and are listed here as they ship.

## Public API

One file, `src/index.ts`, exported as `@gx/core`. Other packages import only that name: deep imports are blocked by the `exports` map and by `pnpm check:imports`.

| Export | What it is |
|---|---|
| `moduleId`, `isModuleId`, `ModuleId`, `MODULE_ID_MAX_LENGTH` | Validated, branded register and manifest ids |
| `MODULE_ID` | This package's register id, `core` |

## Depends on

Nothing: core has no dependencies.

## Tests

```
pnpm vitest run --project core
```
