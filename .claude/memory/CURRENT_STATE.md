# Current state

_Last updated: 2026-11-05 by session 2026-11-05-k0-t14-core-ports. Rewrite this file; keep it under 150 lines._

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
| K0-T09 API gate | done | Staff review approved; CR-001 wording proposed |
| K0-T14 core ports | done | Ports in core, fakes and 9 contract suites in testkit, v0.1.0; security APPROVE, staff APPROVE WITH FIXES (all fixed); debt TD-7 to TD-13 |
| K0-T04, T06, T08, T10 to T13 | todo | Next: T04 redacted logging (threat model first) |
| Supabase and Vercel | Supabase project exists (ref ubktdvbgtkgqumhjodyn); Vercel not created | Keys are in the git-ignored `.env.supabase.local` (not read by app code, ADR-0006). CLI not linked: needs this project's access token and the DB password. Region (Mumbai) and Postgres 17 are unverified |
| EPC pack | todo | Phase 0 validation not started |

## In progress right now
Nothing in progress. K0-T14 is Done (security APPROVE, staff APPROVE WITH FIXES, all fixed). Uncommitted on branch `chore/epc-pack-plan`; move it to its own branch before committing (owner's call).

## Next up (ordered)
1. Commit K0-T14 on its own branch (owner). TD-7 (transaction binding) must be decided at K6-T01.
2. K0-T04 redacted logging (S3: threat model by gx-security-reviewer before code). It uses `classifyField` from core.
3. K0-T06 test kit (tenant matrix, frozen clock, fixtures, pool-leak helper), then K0-T08 boundary lint (also TD-6), K0-T10 CI with Postgres 17 (also TD-5), K0-T11, K0-T12 (needs T-014) and K0-T13.

## Blockers and decisions needed (owner)
- Aadarsh: create the Supabase and Vercel projects in Mumbai; record the Postgres major version in the K0 brief (ADR-0006 gate).
- Aadarsh: D-05 (before K2-T15), D-06 (before K5-T01), D-07 (before K3-T09).
- privacycheck false positive in tools/plangen/epc_gen.py:582 will fail the K0-T10 CI stage (suggested as a separate task).

## Environment facts
- Environments: local only `OBSERVED`. No CI workflow, preview, staging or production yet.
- Node 24 is required (`.node-version`, `engines`). The cloud container ships Node 22 and this Mac has Node 26, so put a Node 24 binary first on PATH (LEARNINGS 2026-11-05).
- How to run tests: `pnpm install` then `pnpm verify` (format, lint, typecheck, build, check:imports, tests). One package: `pnpm vitest run --project <id>`.
- How to deploy: not set up (K0-T10 CI, later apps/web on Vercel).
- Local Postgres 16 exists in the container but is not wired; the version must match the Supabase project.

## Baseline: what was green last time
- tests: 682 unit tests pass (2026-11-05, Node 24.22.2, macOS); test:db 23 of 23 last run 2026-11-04 on local Postgres 16.
- typecheck/lint: typecheck and build 13 of 13, ESLint 0 warnings, Prettier clean, check:imports 0 violations, api:check 0, check:manifests 0.
- privacycheck: 1 pre-existing error (false positive above). prdtool check: 0 errors, 8 warnings (TBD dates).
