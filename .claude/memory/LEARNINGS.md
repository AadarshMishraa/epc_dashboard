# Learnings and traps

One bullet each, newest last. Format: `- YYYY-MM-DD [area] what is true — why it matters (evidence)`.
- 2026-11-04 [toolchain] TypeScript 7.0 (npm `latest`) is the native port with only `unstable/*` APIs; typescript-eslint 8.x needs `typescript <6.1`. Pin 6.0.x until both move (npm view, 2026-11-04).
- 2026-11-04 [env] The cloud container ships Node 22; the repo requires Node 24 and install refuses 22. Use a Node 24 binary (download from nodejs.org, verify SHASUMS256) and put it first on PATH.
- 2026-11-04 [workspace] Tests and typecheck resolve `@gx/*` to source through the `@gx/source` export condition (vitest `resolve.conditions`, tsconfig `customConditions`); runtime and `tsconfig.build.json` resolve to `dist/`. A generic `source` condition name would also match third-party packages, so it is namespaced.
- 2026-11-04 [compliance] privacycheck flags prose that names a forbidden field (tools/plangen/epc_gen.py:582 "Do not store Aadhaar numbers"). It is a false positive, but it will fail the privacycheck CI stage (K0-T10) until the checker or the text changes.
- 2026-11-04 [map] codemap.py does not resolve `@gx/*` workspace imports, so MAP.md under-reports package dependencies; `pnpm check:imports` is the authority for the package graph.
- 2026-11-04 [env] The cloud session's network policy blocks government and review sites (pmsuryaghar.gov.in, g2.com, capterra.in), so web research returns search summaries only. Treat it as leads and verify by hand or allow the hosts.
- 2026-11-04 [env] No Docker daemon in the cloud container, so `supabase start` cannot run here; database integration tests need local Postgres or CI.
- 2026-11-04 [migrations] A keyword deny-list misses security changes (DISABLE RLS, ALTER POLICY, DO blocks, END). Judge statements by an allow-list of heads, and gate security statements separately from destructive ones.
- 2026-11-04 [env] The sandbox refuses to run downloaded database binaries; use the system Postgres 16 locally and pin 17 in CI.
- 2026-11-04 [postgres] COMMIT on a failed transaction performs a rollback, so 'replace ROLLBACK with COMMIT' is an equivalent mutation; prove atomicity with fault injection instead.
- 2026-11-05 [env] The Mac has no Node 24, only Node 26 from Homebrew. A checksum-verified official Node 24 tarball in the session scratchpad, plus `corepack enable --install-directory <that bin>`, gives pnpm 10.34.9. node_modules was not installed before this session.
- 2026-11-05 [tooling] macOS sed has no `\b`. A rename with `\bName<` silently matched nothing, and `pnpm api:update` still reported 0 problems (TD-5). Run `pnpm typecheck` after any scripted rename.
- 2026-11-05 [tooling] zsh does not word-split unquoted $var, so a helper that passes "--project core" as one variable gives vitest one bad argument and prints nothing. Pass flags as separate quoted arguments.
- 2026-11-05 [env] The Mac shell has a SUPABASE_ACCESS_TOKEN set that Supabase rejects as invalid, and the global CLI is 2.109.1 while config.toml came from 2.122.0. Link this repo with a project-specific token set per command, never `supabase login`, so the other project's CLI state stays untouched. `curl` did not resolve in the Bash tool late in the session; Node `fetch` works.
