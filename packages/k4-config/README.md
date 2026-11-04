# @gx/k4-config

Configuration and custom fields: scoped config with versions, labels, lookup lists, typed fields, the condition language and bundles.

- Plan: [K4 brief](../../docs/plans/001-foundation/K4-config.md), wave 3. Layer L0 module.
- Register id: `k4-config` in [packages/register.json](../register.json).
- Status: skeleton from K0-T02. Capabilities, ports, events and extension points arrive with the tasks in the brief and are listed here as they ship.

## Public API

One file, `src/index.ts`, exported as `@gx/k4-config`. Other packages import only that name: deep imports are blocked by the `exports` map and by `pnpm check:imports`.

| Export | What it is |
|---|---|
| `MODULE_ID` | This package's register id, `k4-config` |

## Depends on

`@gx/core`

## Tests

```
pnpm vitest run --project k4-config
```
