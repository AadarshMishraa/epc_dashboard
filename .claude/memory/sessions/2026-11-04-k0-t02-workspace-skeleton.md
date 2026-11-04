# 2026-11-04 — k0-t02-workspace-skeleton

## Goal
Read the plan and start implementing: wave 0, first ready task K0-T02 (T-002, F-01) workspace skeleton.

## Done
- Root workspace: pnpm 10.34.9 workspaces with supply-chain settings, Turborepo, strict TypeScript 6.0.3 base config, ESLint strict type-checked, Prettier, Vitest projects from the register, Node 24 pin, root README.
- `packages/register.json` module register; 12 packages (10 modules, testkit and toolchain support), each with one public-API file, README, changelog, build and typecheck configs.
- `@gx/core`: branded `ModuleId` with `isModuleId` and `moduleId`; core builds without Node types (no I/O guard).
- `@gx/toolchain`: import-graph check (`pnpm check:imports`), 9 rules, CLI with exit codes 0, 1 and 2.
- Docs: system-design sections 6 and 7, decisions, learnings, open question for the Postgres gate.

## Verified (command → result)
- Fresh clone simulation, `pnpm install --frozen-lockfile && pnpm verify` → exit 0 in 31 s: Prettier clean, ESLint 0, typecheck 12/12, build 12/12, check:imports 12 packages 0 violations, 85/85 tests; after review fixes 102/102.
- Tests without `dist/` → 85/85 (source resolution works); built CLI from `dist/` → 0 violations.
- Mutation check: 10 critical rules disabled one at a time → each turned at least one test red; core using `process` → build error TS2591.
- Node 22 install → ERR_PNPM_UNSUPPORTED_ENGINE (guard works).
- gx-staff-reviewer: not approved (2 High false negatives in the scanner and in alias handling), fixed with tests and mutation checks, re-review approved.

## Not verified (and why)
- CI: no pipeline until K0-T10.
- Turbo remote cache, Vercel build: not set up.

## Decisions made (also in DECISIONS.md)
Workspace shape and register; toolchain pins; supply-chain install policy; started K0-T02 with the Supabase gate open.

## Traps found (also in LEARNINGS.md)
TypeScript 7 lacks a stable API; container Node is 22; namespaced source condition; privacycheck prose false positive; codemap misses workspace imports.

## Next
K0-T03 core types, then K0-T07 and K0-T09; S3 tasks K0-T14 and K0-T04 need a threat model first.

## Files touched
Root configs, README.md, pnpm-lock.yaml, packages/**, docs/architecture/system-design.md, docs/plans/001-foundation/K0-core.md (box), docs/prd/STATUS.md, .claude/memory/*, .claude/map/* (regenerated).

## Continued: Supabase and Vercel setup, K0-T03, research
- Done: Supabase config (Postgres 17, only safe surfaces on), vercel.json (bom1, headers, git deploys off), .env.example, runbook docs/operations/environments.md, guard test, ADR-0006 amendment (commit 8c0a4bc). K0-T03 core types: Context, Actor, CorrelationId, UUIDv7 Id generator, Clock, Result, error catalogue, toErrorResponse.
- Verified: `pnpm verify` → 175 tests, 0 import violations; 9 core mutations each turn a test red; a config mutation (Data API back on) turns a test red.
- Not verified: hosted Supabase and Vercel (not created); local `supabase start` (no Docker daemon in the container); research sources (network policy blocks the hosts).
- Next: close the K0-T03 review; then K0-T07 manifest validator and K0-T09 API diff; then S3 tasks K0-T14 and K0-T04 with threat models.

## Continued: K0-T05 and K0-T07
- Done: @gx/migrate (K0-T05). Its review found that expand migrations could disable RLS, alter policies or hide work in DO blocks; rebuilt as an allow-list with a security-review directive, plus runner fixes (timeouts, session pinning, reset, dirty state, grandfathering, versioned ledger). K0-T07 manifest validator with 10 module manifests.
- Verified: verify → 321 unit tests; test:db → 23 of 23 on Postgres 16.15; mutations turn tests red, except one equivalent mutation, covered by a fault-injection test.
- Not verified: Postgres 17 (CI, K0-T10), transaction-pooler refusal (no pooler locally), and the K0-T05 re-review and K0-T07 review (in progress).
- Next: close both reviews; K0-T09 API diff; K0-T14 and K0-T04 (S3, threat model first); K0-T06 test kit.

## Closed: K0-T05 and K0-T07 done
- K0-T05 approved after 3 review passes (views, functions, materialized views, blocking indexes and upserts added to the scanner). K0-T07 approved after 2 passes (tool names and event versions unique by key, pack layer L3 or L4, discovery limited to module locations, schema paths kept inside the package).
- Verified: verify → 352 tests; test:db 23 of 23; every new rule mutation-proven.
- Debt: docs/maintenance/technical-debt.md TD-1 (pack version and depends) and TD-2 (cross-package migration ordering).
- Next session: K0-T09, then the S3 tasks K0-T14 and K0-T04 (threat model first).
