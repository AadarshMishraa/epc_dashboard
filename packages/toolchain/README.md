# @gx/toolchain

Checks that keep the foundation honest and extractable: import graph, manifest validator, boundary lint and public-API diff.

- Plan: [K0 brief](../../docs/plans/001-foundation/K0-core.md), wave 0. Support package in the core lane (not a module).
- Register id: `toolchain` in [packages/register.json](../register.json).
- Status: import-graph check (K0-T02), manifest validator (K0-T07) and public-API gate (K0-T09). The boundary lint (K0-T08) joins them.

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

Finds every `manifest.json` under `packages/` and `packs/`. Every `kind: module` package must have one; a foundation manifest must match its register entry (`id`, `depends`) and its `package.json` version, and be layer L0. A pack module needs no foundation edit (F-06-AC3). Unknown keys fail and are named. Across all manifests:

- entities have one owner, and a module's permissions, workflow hooks, events and custom-field hosts must name its own entities;
- events are versioned (`{ name, version, schema }`), every consumed event and version is emitted by someone, and schema files exist;
- tools have mode `read` or `draft`, a unique name, and one of the module's own permissions;
- error codes, table prefixes and module ids have one owner each, and core's error codes are reserved;
- dependencies exist and point to the same or a lower layer; `config_schema` exists.

Cross-checks are skipped (with one note) while any manifest fails to parse. Output is `file: message`; exit codes are 0, 1 and 2.

## Public-API gate

```
pnpm api:update                         # rewrite every package's public-api.json from its source
pnpm api:check                          # the committed reports match the source and package.json
pnpm api:check --base main              # also require a version bump that covers each change (CI)
pnpm api:check --base main --allow-format-change   # only in a pull request that changes the report format
```

Each package commits `public-api.json`, built from the compiler's own declaration output (`.d.ts`) for every export of `src/index.ts`. It is normalised: comments are removed, there are no absolute paths, and entries are sorted in byte order. So it sees constructors, statics, modifiers, `readonly`, call and index signatures, overloads, enums, namespaces (including `export * as`), merged declarations and type-only exports. Any change to that text is breaking unless it is provably an addition.

| Change against the merge-base with `--base` | From 1.0.0 | Before 1.0.0 |
|---|---|---|
| Export removed, meaning changed (for example value to type-only), or declaration text changed | major | minor |
| Export added, or an interface that only gains optional members | minor | none |

Fails closed:
- **Forgotten export:** an exported signature uses a type declared in the package but not exported. Export it, so its changes are tracked.
- **`any`** in the public API.
- **Report format change:** a base report in another report format needs `--allow-format-change`, after a review of the diff by hand.
- **Versions:** a version going back, or a base ref that does not exist (exit 2).

Base reports are found by package name through the base commit's register. Packages that are new since the base are listed, not silently skipped. CI must fetch enough history for `git merge-base`.

## Public API

One file, `src/index.ts`, exported as `@gx/toolchain`. Other packages import only that name.

| Export | What it is |
|---|---|
| `checkImportGraph`, `formatViolation`, `REGISTER_PATH` | Run the import-graph check and print its findings |
| `ImportGraphOptions`, `ImportGraphResult`, `Violation`, `RuleId` | Types of the check's input and output |
| `findImports`, `ImportReference` | List the module specifiers in a source file, with lines |
| `parseRegister`, `Register`, `RegisterEntry`, `RegisterParse` | Validate `packages/register.json` |
| `checkApi`, `extractApi`, `diffApi`, `requiredBump`, `bumpBetween`, `bumpSatisfies`, `parseVersion`, `API_REPORT_FILE` and their types | Public-API reports and the semver gate |
| `checkManifests`, `validateManifests`, `manifestSchema`, `MANIFEST_FILE`, `Manifest`, `ManifestInput`, `ManifestProblem`, `ManifestCheckResult`, `Layer` | Validate module manifests |
| `MODULE_ID` | This package's register id, `toolchain` |

## Depends on

`@gx/core`; `typescript` (scanner) and `zod` (register and `package.json` validation).

## Tests

```
pnpm vitest run --project toolchain
```
