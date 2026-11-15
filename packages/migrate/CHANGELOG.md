# Changelog

Notable changes to `@gx/migrate`. Versions follow semver over the public API in `src/index.ts`.

## Unreleased

### Added

- `scanRelations` (K0-T08): every relation a migration creates, alters, drops, truncates, indexes, triggers, polices or comments on (tables, views, materialised views, sequences, foreign tables; `RENAME TO` read both ways; `SELECT ... INTO`), with line and `TEMP` flag. A statement whose target it cannot read, including `CREATE SCHEMA ... CREATE ...`, comes back as unreadable instead of being skipped. Used by the boundary lint's table-ownership rule.
- Migration framework (K0-T05): package-namespaced, gap-free, forward-only SQL migrations; expand by default, destructive statements only in contract migrations with a reason; dependency order from the register; checksum ledger; one advisory lock; one transaction per migration with its ledger row; `gx-migrate check | plan | up`.
