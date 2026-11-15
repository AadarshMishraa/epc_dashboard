# 2026-11-12 — k0-t04-redacted-logging

## Goal
Compare the plan with real Indian solar EPC requirements, then do the next step in the queue: K0-T04 (T-004) structured logging with redaction, feature F-02.

## Done
- Comparison: read the pack PRD, roadmap, domain notes and the November research; searched current sources. Nine new leads logged as R11 to R19 in IMPROVEMENTS.md. No PRD or pack file edited.
- Threat model: gx-security-reviewer rewrote `docs/security/threat-models/K0-T04-logging.md` (scalar-only fields; the 2026-11-04 version assumed a nested walker).
- Core v0.1.1: `src/logging/{scrub,error-summary,logger}.ts`; exports `createLogger`, `classified`, `summariseError`, `LOG_LEVELS`, `LOG_MAX_FIELDS`, `LOG_MAX_LINE_BYTES` and types. The scrubber is internal. `classifyField` now reports a malformed answer through `onError`.
- Review: gx-security-reviewer, APPROVE WITH FIXES (3 Medium, 7 Low). Fixed M1 (rejecting async sink), M2 (joined-up key names), M3 (correlation id that looks like a phone or id), L1, L2 in part, L3, L4, L6, L7. Open: TD-14, TD-15.
- Updated: API report, changelog, README, system-design section 7 and change log, technical debt, K0 brief box, STATUS.

## Verified (command → result)
- `pnpm verify` → exit 0: Prettier, ESLint 0, typecheck and build 13 of 13, import graph 0 violations, manifests 0, public API 0, migrations 0, tests 1,094 of 1,094 (baseline 682).
- `pnpm vitest run --project core src/logging` → 408 of 408 in 2 files.
- Mutations: about 70 distinct rules removed or shifted across five runs; 4 survived at first and each got a test; 1 more is equivalent for correctness (the input cap before normalisation is a speed guard).
- `prdtool.py check` → 0 errors, 8 TBD-date warnings. `privacycheck.py` → 1 pre-existing false positive (epc_gen.py:582).

## Not verified (and why)
- The fixes after the review were not re-reviewed by gx-security-reviewer; tests and mutations cover them.
- The gx-qa-engineer pass named in the brief did not run as a separate agent.
- No real sink, host or log store exists (K0-T12, K0-T13), so nothing ran outside unit tests. No CI.
- Industry leads R11 to R19 come from search summaries; no primary page was opened.

## Decisions made (also in DECISIONS.md)
- Logger shape: context per call, event names not messages, flat scalar fields, full-mask class tokens, scrubber plus key deny list as backstops, error summaries, 8,192-byte lines, never throws.

## Traps found (also in LEARNINGS.md)
- A unicode escape typed into a file through the editor tool can arrive as the raw character. privacycheck words in source.

## Next
- Owner: commit branch `feat/K0-T04`.
- K0-T06 test kit, then K0-T08, K0-T10, K0-T11, K0-T12, K0-T13.

## Files touched
packages/core/{package.json,manifest.json,public-api.json,CHANGELOG.md,README.md,src/index.ts,src/index.test.ts,src/errors.ts,src/ports/classification.ts,src/ports/records.test.ts,src/logging/*}
docs/security/threat-models/K0-T04-logging.md, docs/plans/001-foundation/K0-core.md, docs/prd/STATUS.md, docs/architecture/system-design.md, docs/maintenance/technical-debt.md
.claude/memory/{CURRENT_STATE,IMPROVEMENTS,DECISIONS,LEARNINGS}.md
