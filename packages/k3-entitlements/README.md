# @gx/k3-entitlements

Entitlements and module registry: installed modules, plans, limits, usage metering and feature flags.

- Plan: [K3 brief](../../docs/plans/001-foundation/K3-entitlements.md), wave 4. Layer L0 module.
- Register id: `k3-entitlements` in [packages/register.json](../register.json).
- Status: skeleton from K0-T02. Capabilities, ports, events and extension points arrive with the tasks in the brief and are listed here as they ship.

## Public API

One file, `src/index.ts`, exported as `@gx/k3-entitlements`. Other packages import only that name: deep imports are blocked by the `exports` map and by `pnpm check:imports`.

| Export | What it is |
|---|---|
| `MODULE_ID` | This package's register id, `k3-entitlements` |

## Depends on

`@gx/core`

## Tests

```
pnpm vitest run --project k3-entitlements
```
