# @gx/k8-files

Files and vault: blob storage port, file model, secure upload and download, document types with expiry, scanning and quotas.

- Plan: [K8 brief](../../docs/plans/001-foundation/K8-files.md), wave 5. Layer L0 module.
- Register id: `k8-files` in [packages/register.json](../register.json).
- Status: skeleton from K0-T02. Capabilities, ports, events and extension points arrive with the tasks in the brief and are listed here as they ship.

## Public API

One file, `src/index.ts`, exported as `@gx/k8-files`. Other packages import only that name: deep imports are blocked by the `exports` map and by `pnpm check:imports`.

| Export | What it is |
|---|---|
| `MODULE_ID` | This package's register id, `k8-files` |

## Depends on

`@gx/core`

## Tests

```
pnpm vitest run --project k8-files
```
