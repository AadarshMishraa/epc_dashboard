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
