# Changelog

Notable changes to `@gx/toolchain`. Versions follow semver over the public API in `src/index.ts`.

## Unreleased

### Changed

- The register check rejects a `kind: module` package that lists a `support` package (test fakes, tooling) in its runtime `depends`. Support packages belong in `devDepends`. `testkit` is refused in any package's runtime `depends`, support packages included (K0-T14 security review).

### Added

- Boundary lint (K0-T08): `checkBoundaries` and `pnpm check:boundaries` run the import-graph rules plus `table-ownership` (a migration creates or changes only relations that start with its module's `table_prefix`, and a statement it cannot read is a violation; `TEMP` relations are exempt) and `industry-word` (no industry noun, plural or not, in `packages/` source, data files under `src/`, migrations, manifests, `package.json` or file and folder names; tests and unregistered packs are exempt). `// boundary:allow industry-word <reason>` allows one line (or the next); a marker without a reason, or one that allows nothing, is itself a violation (`allow-marker`). `RuleId` gained three members. The package now depends on `@gx/migrate` for the SQL scanner.
- Package skeleton: public-API file, register entry, README and changelog (K0-T02).
- Import-graph check (`pnpm check:imports`, `checkImportGraph`): the register matches the workspace, each package exposes exactly one public-API file, and packages import only what the register allows, through public APIs (K0-T02).
- Manifest schema and validator (`pnpm check:manifests`, `checkManifests`, K0-T07): strict JSON manifests, cross-checked against the register and each other.
- Public-API reports and semver gate (`pnpm api:update`, `pnpm api:check [--base <ref>]`, `checkApi`, K0-T09).
