# Current state

_Last updated: 2026-11-05 by session 2026-11-05-k0-t04-redacted-logging. Rewrite this file; keep it under 150 lines._

## What this product is (3 lines)
A reusable multi-tenant foundation (kernel K0 to K8, TypeScript monorepo in `packages/`) and its first vertical, the solar EPC owner dashboard (`packs/epc`).
Stack per ADR-0006: Node.js 24, Next.js on Vercel, Supabase Postgres and Storage in Mumbai, pnpm and Turborepo.
Scope and progress: docs/prd/STATUS.md; work queue docs/plans/TASKS.md; current wave 0 (docs/plans/001-foundation/K0-core.md).

## Status
| Area | Status | Notes |
|---|---|---|
| Architecture ADR-0001 to 0006 | done | Accepted 2026-11-04 |
| K0-T01 stack decision | done | ADR-0006 |
| K0-T02 workspace skeleton | done | K0-T08 owes deferred findings (DECISIONS) |
| K0-T03 core types | done | |
| K0-T05 migrations | done | @gx/migrate; allow-list scanner |
| K0-T07 manifest validator | done | |
| K0-T09 API gate | done | CR-001 wording proposed |
| K0-T14 core ports | done | debt TD-7 to TD-14 |
| K0-T04 redacted logging | done | `createLogger` + backstop in core, `MemoryLogSink` in testkit, v0.1.1. Security: REQUEST CHANGES, then APPROVE WITH FIXES, all fixed. Residuals TD-15, TD-16 |
| K0-T06, T08, T10 to T13 | todo | Next: K0-T06 test kit |
| Supabase and Vercel | Supabase project exists (ref ubktdvbgtkgqumhjodyn); Vercel not created | Keys in the git-ignored `.env.supabase.local` (not read by app code). Region (Mumbai) and Postgres 17 unverified |
| EPC pack | todo | Phase 0 validation not started |

## In progress right now
Nothing. Work is on branch `claude/nice-allen-uihlqb` (main + pollution fix + K0-T04), pushed; no PR opened.

## Next up (ordered)
1. K0-T06 test kit (tenant matrix, frozen clock, fixtures, pool-leak helper).
2. K0-T08 boundary lint (TD-6; also a rule against string interpolation into log fields, TD-16), K0-T10 CI with Postgres 17 (TD-5), K0-T11, K0-T12 (needs T-014), K0-T13 (logs the upstream correlation id as its own field, TD-16; body size limit, TD-15).

## Blockers and decisions needed (owner)
- Aadarsh: create the Vercel project; verify the Supabase region (Mumbai) and Postgres 17; record the Postgres major version in the K0 brief (ADR-0006 gate).
- Aadarsh: D-05 (before K2-T15), D-06 (before K5-T01), D-07 (before K3-T09); CR-001 decision.
- privacycheck false positive in tools/plangen/epc_gen.py:582 will fail the K0-T10 CI stage.

## Environment facts
- Node 24 is required. The cloud container ships Node 22: put the checksum-verified Node 24.22.2 in the session scratchpad first on PATH (`<scratchpad>/node/node-v24.22.2-linux-x64/bin`), pnpm 10.34.9 via corepack.
- How to run tests: `pnpm install` then `pnpm verify`. One package: `pnpm vitest run --project <id>`. Gate commits on the verify exit code.
- Logging convention: name money and time fields with a unit (`amount_paise`, `started_at_millis`) or 9+ digit numbers are masked; log `Date` or ISO strings, not `2026-11-05 12:30`.
- How to deploy: not set up (K0-T10 CI, later apps/web on Vercel).

## Baseline: what was green last time
- tests: `pnpm verify` exit 0, 2026-11-05, Node 24.22.2, cloud container (count in the session log). test:db 23 of 23 last run 2026-11-04 on local Postgres 16.
- typecheck, build, ESLint 0, Prettier clean, check:imports 0, api:check 0, check:manifests 0.
- privacycheck: 1 pre-existing error (false positive above). prdtool check: 0 errors, 8 warnings (TBD dates).
