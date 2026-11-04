# @gx/k2-identity

Identity and access: credentials, sessions, MFA, roles and permissions as data, service accounts and OAuth for AI clients.

- Plan: [K2 brief](../../docs/plans/001-foundation/K2-identity.md), wave 4. Layer L0 module.
- Register id: `k2-identity` in [packages/register.json](../register.json).
- Status: skeleton from K0-T02. Capabilities, ports, events and extension points arrive with the tasks in the brief and are listed here as they ship.

## Public API

One file, `src/index.ts`, exported as `@gx/k2-identity`. Other packages import only that name: deep imports are blocked by the `exports` map and by `pnpm check:imports`.

| Export | What it is |
|---|---|
| `MODULE_ID` | This package's register id, `k2-identity` |

## Depends on

`@gx/core`

## Tests

```
pnpm vitest run --project k2-identity
```
