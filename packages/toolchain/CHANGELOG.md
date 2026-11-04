# Changelog

Notable changes to `@gx/toolchain`. Versions follow semver over the public API in `src/index.ts`.

## Unreleased

### Added

- Package skeleton: public-API file, register entry, README and changelog (K0-T02).
- Import-graph check (`pnpm check:imports`, `checkImportGraph`): the register matches the workspace, each package exposes exactly one public-API file, and packages import only what the register allows, through public APIs (K0-T02).
- Manifest schema and validator (`pnpm check:manifests`, `checkManifests`, K0-T07): strict JSON manifests, cross-checked against the register and each other.
- Public-API reports and semver gate (`pnpm api:update`, `pnpm api:check [--base <ref>]`, `checkApi`, K0-T09).
