# Current state

_Last updated: 2026-11-04 by session 2026-11-04-k0-t02-workspace-skeleton. Rewrite this file; keep it under 150 lines._

## What this product is (3 lines)
A reusable multi-tenant foundation (kernel K0 to K8, TypeScript monorepo in `packages/`) and its first vertical, the solar EPC owner dashboard (`packs/epc`).
Stack per ADR-0006: Node.js 24, Next.js on Vercel, Supabase Postgres and Storage in Mumbai, pnpm and Turborepo.
Scope and progress: docs/prd/STATUS.md; work queue docs/plans/TASKS.md; current wave 0 (docs/plans/001-foundation/K0-core.md).

## Status
| Area | Status | Notes |
|---|---|---|
| Architecture ADR-0001 to 0006 | done | Accepted 2026-11-04 |
| K0-T01 stack decision | done | ADR-0006 |
| K0-T02 workspace skeleton | done | 12 packages, register, import-graph check; staff review approved after fixes; K0-T08 owes deferred findings (DECISIONS) |
| K0-T03 core types | done | Staff review approved after fixes (TenantId brand, TenantContext, monotonic clock, retry_after and current_version, initiatedBy) |
| K0-T05 migrations | done | @gx/migrate; allow-list scanner; approved after three review passes |
| K0-T07 manifest validator | done | Entity ownership, versioned events, pack discovery; approved after two passes |
| K0-T09 public-API gate | done | .d.ts-based; CR-001 proposed |
| K0-T14 core ports | done | 9 ports, fakes and contracts; security review approved after fixes |
| K0-T04, T06, T08, T10 to T13 | todo | K0-T04 threat model ready (docs/security/threat-models) |
| Supabase and Vercel | configured, not created | Postgres 17 pinned; owner creates the projects and adds keys (docs/operations/environments.md) |
| EPC pack | todo | Phase 0 validation not started |

## In progress right now
Nothing. K0-T02 is committed on `claude/nice-allen-uihlqb`.

## Next up (ordered)
1. K0-T04 redacted logging (both S3: threat model by gx-security-reviewer before code).
3. K0-T06 test kit (tenant matrix, contract harness, frozen clock), then K0-T08 boundary lint (layers by path, industry words, table ownership), K0-T10 CI with Postgres 17, K0-T11, K0-T12 and K0-T13.
4. (was) K0-T07 manifest schema and validator, then K0-T08 boundary lint (make register `depends` and manifest `depends` one source of truth).
3. K0-T09 public-API diff and semver gate (TypeScript 6 compiler API).
4. K0-T14 core ports with fakes and K0-T04 redacted logging (both S3: threat model by gx-security-reviewer before code).
5. K0-T05, K0-T11 once Aadarsh records the Postgres major version.

## Blockers and decisions needed (owner)
- Aadarsh: create the Supabase and Vercel projects in Mumbai; record the Postgres major version in the K0 brief (ADR-0006 gate).
- Aadarsh: D-05 (before K2-T15), D-06 (before K5-T01), D-07 (before K3-T09).
- privacycheck false positive in tools/plangen/epc_gen.py:582 will fail the K0-T10 CI stage (suggested as a separate task).

## Environment facts
- Environments: local only `OBSERVED`. No CI workflow, preview, staging or production yet.
- Node 24 is required (`.node-version`, `engines`); the cloud container ships Node 22, so put a Node 24 binary first on PATH.
- How to run tests: `pnpm install` then `pnpm verify` (format, lint, typecheck, build, check:imports, tests). One package: `pnpm vitest run --project <id>`.
- How to deploy: not set up (K0-T10 CI, later apps/web on Vercel).
- Local Postgres 16 exists in the container but is not wired; the version must match the Supabase project.

## Baseline: what was green last time
- tests: 492 unit tests pass; test:db 23 of 23 (local Postgres 16) (2026-11-04, Node 24.22.2).
- typecheck/lint: typecheck 12 of 12 packages, ESLint 0 warnings, Prettier clean, build 12 of 12, check:imports 0 violations.
- privacycheck: 1 pre-existing error (false positive above). prdtool check: 0 errors, 8 warnings (TBD dates).
