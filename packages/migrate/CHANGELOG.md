# Changelog

Notable changes to `@gx/migrate`. Versions follow semver over the public API in `src/index.ts`.

## Unreleased

### Added

- `findCreatedTables` (K0-T08): the tables a migration creates (`CREATE TABLE` in every form and the new name in `RENAME TO`), with their line and whether they are `TEMP`. Used by the boundary lint's table-ownership rule.
- Migration framework (K0-T05): package-namespaced, gap-free, forward-only SQL migrations; expand by default, destructive statements only in contract migrations with a reason; dependency order from the register; checksum ledger; one advisory lock; one transaction per migration with its ledger row; `gx-migrate check | plan | up`.
