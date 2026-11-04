# GX foundation and EPC dashboard

A multi-tenant foundation (`packages/`) and its first vertical, the solar EPC pack (`packs/epc`). Architecture: [docs/adr](docs/adr) and [docs/architecture](docs/architecture). Scope and progress: [docs/prd/STATUS.md](docs/prd/STATUS.md). How work is planned and executed: [docs/plans/README.md](docs/plans/README.md).

## Requirements

- Node.js 24 LTS (`.node-version`). Install refuses other majors.
- pnpm: the version pinned in `package.json` (`packageManager`). Any pnpm 10 or later switches to it automatically.

## Commands

```
pnpm install            # lockfile is authoritative; versions younger than 7 days are refused
pnpm verify             # everything below, in the order CI will run it
pnpm format:check       # Prettier on code and config
pnpm lint               # ESLint with typescript-eslint strict type-checked rules, 0 warnings
pnpm typecheck          # every package and its tests, against source
pnpm build              # every package to dist/, in dependency order
pnpm check:imports      # register, public-API and import-graph rules (packages/toolchain)
pnpm test               # Vitest, one project per registered package
pnpm vitest run --project k1-tenancy   # one package
```

## Layout

| Path | What |
|---|---|
| `packages/` | Foundation packages; [packages/register.json](packages/register.json) lists them and what each may depend on |
| `packs/` | Verticals; depend on the foundation, never the reverse |
| `design/` | Design tokens, components and reference page |
| `docs/` | ADRs, architecture, compliance, design system, guidelines, plans, PRD |
| `tools/plangen` | Generator for the plan and PRD files |

Rules for every change: [development guidelines](docs/guidelines/development-guidelines.md) and [security guidelines](docs/guidelines/security-guidelines.md).
