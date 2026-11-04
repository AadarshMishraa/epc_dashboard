# @gx/k7a-audit

Audit trail: append-only rows written in the same transaction, tamper-evident hash chain, sensitive-read logging and audit query.

- Plan: [K7 brief](../../docs/plans/001-foundation/K7-audit-privacy.md), wave 2. Layer L0 module.
- Register id: `k7a-audit` in [packages/register.json](../register.json).
- Status: skeleton from K0-T02. Capabilities, ports, events and extension points arrive with the tasks in the brief and are listed here as they ship.

## Public API

One file, `src/index.ts`, exported as `@gx/k7a-audit`. Other packages import only that name: deep imports are blocked by the `exports` map and by `pnpm check:imports`.

| Export | What it is |
|---|---|
| `MODULE_ID` | This package's register id, `k7a-audit` |

## Depends on

`@gx/core`

## Tests

```
pnpm vitest run --project k7a-audit
```
