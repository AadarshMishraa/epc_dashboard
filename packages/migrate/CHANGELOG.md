# Changelog

Notable changes to `@gx/migrate`. Versions follow semver over the public API in `src/index.ts`.

## Unreleased

### Added

- Migration framework (K0-T05): package-namespaced, gap-free, forward-only SQL migrations; expand by default, destructive statements only in contract migrations with a reason; dependency order from the register; checksum ledger; one advisory lock; one transaction per migration with its ledger row; `gx-migrate check | plan | up`.
