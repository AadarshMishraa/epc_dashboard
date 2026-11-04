# @gx/toolchain

Checks that keep the foundation honest and extractable: import graph, manifest validator, boundary lint and public-API diff.

- Plan: [K0 brief](../../docs/plans/001-foundation/K0-core.md), wave 0. Support package in the core lane (not a module).
- Register id: `toolchain` in [packages/register.json](../register.json).
- Status: import-graph check (K0-T02) and manifest validator (K0-T07). The boundary lint (K0-T08) and public-API diff (K0-T09) join them.

## Import-graph check

```
pnpm check:imports            # from the repository root
```

Reads `packages/register.json` and every package in `packages/`. Exit code 0 when clean, 1 with one line per violation (`file:line [rule] message`), 2 when the check cannot run.

| Rule | Fails when |
|---|---|
| `register-invalid` | The register is missing, has an unknown key, breaks the id rule (`@gx/<id>` in `packages/<id>`), names an unknown or own id in `depends`, or has a dependency cycle |
| `register-mismatch` | A package directory has no register entry, an entry has no package, or the package name differs |
| `public-api` | `exports` is not exactly one `"."` entry pointing at `src/index.ts` (source) and `dist/index.*` (built), a `main`, `module`, `browser`, `types` or `typings` field adds a second entry, or `src/index.ts` is missing |
| `workspace-dependency` | `package.json` names a workspace package the register does not allow (`depends` for runtime, plus `devDepends` for tests), uses a spec other than `workspace:*`, or reaches a local package under another name (`workspace:`, `link:`, `file:`, `portal:` or `npm:@gx/` spec) |
| `import-not-allowed` | Source imports a workspace package that is not a declared, allowed dependency |
| `deep-import` | Source imports another package's internals (`@gx/core/src/...`) instead of its public API |
| `self-import` | Source imports its own package by name |
| `relative-escape` | A relative import leaves the package directory |
| `undeclared-import` | Source imports a third-party package not declared in its `package.json` (tests may also use the root's development tools), a builtin without `node:`, a URL, an absolute path, or a computed `import()` or `require()` argument |
| `isolation` | A package the register marks `isolated` (core) has a runtime dependency or uses a `node:` module outside its tests |

References are found by walking the TypeScript syntax tree: every import and export declaration (including `export * as ns from` and `export type *`), `import x = require()`, type-level `import('x')`, `declare module 'x'`, `import()`, `require()`, `require.resolve()`, `import.meta.resolve()` and triple-slash `path` and `types` references. Specifiers in comments and strings are ignored.

Not covered yet (K0-T08): workspace globs in `pnpm-workspace.yaml` (only `packages/` is scanned) and files outside each package's `src/`.

## Manifest validator

```
pnpm check:manifests          # from the repository root
```

Every `kind: module` package must ship `manifest.json` (spec: [module-manifest.md](../../docs/architecture/module-manifest.md)). Unknown keys fail and are named. Across all manifests: `id`, `version` and `depends` must match the register and `package.json`; dependencies point to the same or a lower layer; every consumed event is emitted by some module, and each emitted event belongs to one of the emitter's entities; every tool has mode `read` or `draft` and a declared permission; error codes, table prefixes, events and permissions have one owner each, and core's error codes are reserved. Exit codes: 0, 1 with one line per problem, 2.

## Public API

One file, `src/index.ts`, exported as `@gx/toolchain`. Other packages import only that name.

| Export | What it is |
|---|---|
| `checkImportGraph`, `formatViolation`, `REGISTER_PATH` | Run the import-graph check and print its findings |
| `ImportGraphOptions`, `ImportGraphResult`, `Violation`, `RuleId` | Types of the check's input and output |
| `findImports`, `ImportReference` | List the module specifiers in a source file, with lines |
| `parseRegister`, `Register`, `RegisterEntry`, `RegisterParse` | Validate `packages/register.json` |
| `checkManifests`, `validateManifests`, `manifestSchema`, `MANIFEST_FILE`, `Manifest`, `ManifestInput`, `ManifestProblem`, `ManifestCheckResult`, `Layer` | Validate module manifests |
| `MODULE_ID` | This package's register id, `toolchain` |

## Depends on

`@gx/core`; `typescript` (scanner) and `zod` (register and `package.json` validation).

## Tests

```
pnpm vitest run --project toolchain
```
