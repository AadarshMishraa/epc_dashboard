# Learnings and traps

One bullet each, newest last. Format: `- YYYY-MM-DD [area] what is true — why it matters (evidence)`.
- 2026-11-04 [toolchain] TypeScript 7.0 (npm `latest`) is the native port with only `unstable/*` APIs; typescript-eslint 8.x needs `typescript <6.1`. Pin 6.0.x until both move (npm view, 2026-11-04).
- 2026-11-04 [env] The cloud container ships Node 22; the repo requires Node 24 and install refuses 22. Use a Node 24 binary (download from nodejs.org, verify SHASUMS256) and put it first on PATH.
- 2026-11-04 [workspace] Tests and typecheck resolve `@gx/*` to source through the `@gx/source` export condition (vitest `resolve.conditions`, tsconfig `customConditions`); runtime and `tsconfig.build.json` resolve to `dist/`. A generic `source` condition name would also match third-party packages, so it is namespaced.
- 2026-11-04 [compliance] privacycheck flags prose that names a forbidden field (tools/plangen/epc_gen.py:582 "Do not store Aadhaar numbers"). It is a false positive, but it will fail the privacycheck CI stage (K0-T10) until the checker or the text changes.
- 2026-11-04 [map] codemap.py does not resolve `@gx/*` workspace imports, so MAP.md under-reports package dependencies; `pnpm check:imports` is the authority for the package graph.
