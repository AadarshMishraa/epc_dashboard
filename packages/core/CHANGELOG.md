# Changelog

Notable changes to `@gx/core`. Versions follow semver over the public API in `src/index.ts`.

## Unreleased

### Added

- Package skeleton: public-API file, register entry, README and changelog (K0-T02).
- Core types (K0-T03): `Context` with tenant, actor, correlation and causation ids and clock; `requireTenant` (fails closed); `Actor` including AI clients acting for a user; validated `CorrelationId`; `Id` with an ordered UUIDv7 generator; `Clock`; `Result`; the error catalogue with `toErrorResponse`.
- Core ports (K0-T14): nine port interfaces with fail-closed decision helpers, and the `Secret` class.
