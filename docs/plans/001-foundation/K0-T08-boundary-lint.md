# Plan: K0-T08 boundary lint

Feature F-04 (manifest, boundary and API gates). Risk: MEDIUM (a new gate on every package; no data, auth or money).
Branch `feat/K0-T08`, stacked on `feat/K0-T04` (pushed, no PR yet).

## What already exists `OBSERVED`
- `packages/toolchain/src/import-graph.ts` already fails on: `import-not-allowed` (upward or undeclared workspace import),
  `deep-import` (another package's internals), `self-import`, `relative-escape`, `undeclared-import`, `isolation`,
  `workspace-dependency`, `public-api`. Tests: `import-graph.test.ts`.
- `manifest.ts` already checks entity ownership across manifests and requires `table_prefix` once a module has entities.
- `@gx/migrate` has an SQL scanner (`sql-scan.ts`: `blankCommentsAndStrings`, `splitStatements`) but no table extractor.
- Baseline before this work: `pnpm verify` green on Node 24.22.3 (1,110 tests).

So "no upward imports" and "no cross-package internals" need no new code: the brief's "one failing fixture per rule" is
met for them by pointing at the existing fixtures, and by a CLI-level seeded-violation test.

## Scope
New rules (the brief), in a new `boundaries.ts` in `@gx/toolchain`, run by `pnpm check:boundaries`:
1. `table-ownership`: a `CREATE TABLE` in `<package>/migrations/*.sql` must start with that package's manifest `table_prefix`
   (and a package without a prefix creates no tables). Uses a new additive export from `@gx/migrate`
   (`findCreatedTables`, built on `sql-scan`), not a second SQL parser. `RECOMMENDED`: register change `toolchain.depends += migrate`
   (support to support, no cycle; migrate depends on core only). Additive; flagged for the owner.
2. `industry-word`: no industry noun in `packages/*/src` non-test code, `migrations/` or `manifest.json`. Applies to `packages/` only,
   never `packs/`. Word list in one file, matched as whole words, case-insensitive. Allow marker on the line or the line above:
   `boundary:allow industry-word <reason>` (a reason is required; a marker with no reason is itself a violation).
   Tests are exempt (they may use realistic data); the two GST comments in core get a marker with a reason.
Existing rules: re-exported under the same gate so `check:boundaries` is the single "boundary lint" name that K0-T10 wires into CI.

Inherited from earlier reviews (K0-T02 deferred items, DECISIONS 2026-11-04, TD-6). Done as separate sub-tasks so none is dropped:
| Id | Item | Plan |
|---|---|---|
| T08-a | The two new rules, fixtures, CLI, `verify` wiring | this session |
| T08-b | Reject `@gx/*` keys in `overrides` (pnpm-workspace.yaml, root package.json); reject `git:`, `github:`, tarball and URL specs | this session if small |
| T08-c | Scan files outside `src/` (config files, scripts) for the import rules | next |
| T08-d | `depends` single source of truth: register vs manifest cross-check (DECISIONS line 79) | next |
| T08-e | TD-6: toolchain imports the name patterns from `@gx/core` | next |
| T08-f | Testkit log-capture helper | next (separate from the lint) |
| T08-g | pnpm catalog for typescript and zod pins; `trustPolicy` and `blockExoticSubdeps` (verify support in pnpm 10.34.9 first) | next; needs the owner (supply-chain setting) |
| T08-h | How packs register in the workspace globs (before the EPC pack joins) | owner decision: architecture (rule 4) |

## Honesty about "fails CI"
There is no CI until K0-T10. `OBSERVED` will mean: `pnpm check:boundaries` exits 1 on each seeded fixture and 0 on the repo.
"Fails CI" stays `UNKNOWN` until T10 wires the script.

## Tests (one failing fixture per rule, then mutation checks)
- Per rule: a fixture workspace in a temp dir that violates exactly that rule; assert the rule id, file and line, and that the clean
  fixture passes.
- Table ownership: wrong prefix, no prefix declared, prefix-less package creating a table, quoted and schema-qualified names,
  `CREATE TABLE IF NOT EXISTS`, partitions, a table named in a comment or string (must not count).
- Industry word: word inside comment, identifier, string and JSON; word as a substring of another word (must pass); marker with
  reason passes, marker without reason fails, marker two lines away fails; `packs/` and test files are ignored.
- Mutation pass over both rules (swap the matcher, drop the exemption, drop the prefix check) before review.

## Rollback
Revert the commit; no schema or data change.
