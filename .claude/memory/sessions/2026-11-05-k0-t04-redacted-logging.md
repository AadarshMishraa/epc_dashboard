# 2026-11-05 — k0-t04-redacted-logging

## Goal
Pull the latest main (Supabase setup and K0-T14 had landed), reconcile, and implement K0-T04 (T-004, F-02, S3): structured logging with redaction by classification and correlation on every line.

## Done
- Reconciled with main: kept main's K0-T14, ported the prototype-pollution fix to `isAllowed` and `denialReason`, logged TD-14 (erasure deadline).
- `packages/core/src/logging/`: `createLogger` (one JSON line per call to a `LogSink` port; ids from the context; classification through `classifyField`; never throws, with fallback lines) and `redact.ts` (normalisation, credential and personal-data patterns, secret and personal keys by whole words, unit-key exemption for numbers, error summaries, getter-free walker with one node and character budget).
- `MemoryLogSink` in testkit. `parseCorrelationId` rejects ids the backstop would change. core and testkit 0.1.1.
- gx-security-reviewer: first pass REQUEST CHANGES (2 High, 3 Medium, 6 Low); all fixed with tests in 5cdad64. Residuals TD-15 (Object.keys on huge objects) and TD-16 (free-text names; over-redaction of dates, IPs, decimals).

## Verified (command → result)
- `pnpm verify` → exit 0, 859 tests, lint 0, typecheck and build clean, check:imports 0, manifests 0, api:check 0 (Node 24.22.2, cloud container).
- Mutation checks: 48 on the first version, then 41 on the review fixes and 14 replacements for rewritten code, 6 on MemoryLogSink; all killed.
- `python3 .claude/gx/bin/privacycheck.py` → only the known false positive in tools/plangen/epc_gen.py:582. `prdtool check` → 0 errors, 8 TBD warnings.

## Not verified (and why)
- Second security review pass: running at the time of writing; T-004 stays In review until it approves.
- No real sink or vendor exists yet; the logger has run only against in-memory sinks.

## Decisions made (also in DECISIONS.md)
- Numbers of 9+ digits are masked unless the key ends in a unit word (`amount_paise`, `_millis`), trading a naming convention for readable money and times.
- Error messages kept only for TypeError, RangeError and ReferenceError; no stack frames, because Node 24's `stack` accessor can run a user-set `prepareStackTrace`.

## Traps found (also in LEARNINGS.md)
- The Write tool and heredocs turn ` ` into the literal character; build such characters from code points.
- A `verify; commit` chain committed a lint failure; gate commits on the exit code. Do not edit by line number after Prettier ran.
- NFKC already folds no-break spaces, so a test for space folding needs a tab or U+1680.

## Next
- On security approval: set T-004 to Done in docs/prd/STATUS.md, tick K0-T04 in the K0 brief, update CURRENT_STATE.
- Then K0-T06 test kit, K0-T08 boundary lint (TD-6; add a lint against string interpolation into log fields, TD-16), K0-T10 CI with Postgres 17.

## Files touched
packages/core/src/logging/*, packages/core/src/context.ts and its test, packages/core/src/index.ts and its test, packages/testkit/src/fakes/logging*.ts, packages/testkit/src/index.ts, changelogs, package and manifest versions, public-api.json files, packages/core/README.md, docs/prd/STATUS.md, docs/architecture/system-design.md, docs/maintenance/technical-debt.md, .claude/memory/LEARNINGS.md.
