# Changelog

Notable changes to `@gx/toolchain`. Versions follow semver over the public API in `src/index.ts`.

## Unreleased

### Added

- Package skeleton: public-API file, register entry, README and changelog (K0-T02).
- Import-graph check (`pnpm check:imports`, `checkImportGraph`): the register matches the workspace, each package exposes exactly one public-API file, and packages import only what the register allows, through public APIs (K0-T02).
