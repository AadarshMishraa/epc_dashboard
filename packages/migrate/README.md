# @gx/migrate

Migration framework: package-namespaced, forward-only, expand then contract, run in dependency order with a checksum ledger.

- Plan: [K0 brief](../../docs/plans/001-foundation/K0-core.md), K0-T05, wave 0. Support package in the core lane (not a module).
- Register id: `migrate` in [packages/register.json](../register.json).

## Writing a migration

Each package keeps plain SQL in `packages/<package>/migrations/`, numbered from `0001` with no gaps: `0001_create_tenant.sql`, `0002_add_region.sql`. Tables use the package prefix (`k1_`); the boundary lint (K0-T08) enforces ownership.

| Directive (a comment line) | Meaning |
|---|---|
| none | `expand` phase: additive only. The previous release must keep working on the new schema |
| `-- gx:phase contract` | Allowed to remove or rewrite. Needs `-- gx:reason <what it removes; which release stopped using it>` |
| `-- gx:no-transaction` | Runs outside a transaction, for `CREATE INDEX CONCURRENTLY`. Exactly one statement; make it idempotent (`IF NOT EXISTS`) because a crash after the statement and before the ledger row reruns it |

Rejected in an expand migration (each needs a contract migration in a later release): `DROP` (except `DROP NOT NULL`), `RENAME`, column type changes, `SET NOT NULL`, adding a `NOT NULL` column without a default, `DELETE`, `TRUNCATE`, `UPDATE` (backfills run as tenant-aware jobs). `BEGIN`, `COMMIT`, `ROLLBACK` and `SAVEPOINT` are never allowed: the runner owns transactions. Keywords inside comments, strings, quoted identifiers and dollar-quoted bodies are ignored.

Never edit or delete an applied migration; rollback is a forward fix.

## Running

```
pnpm migrate check                      # validate files; no database (CI and pre-commit)
pnpm migrate plan                       # pending migrations, applies nothing
pnpm migrate up                         # apply pending migrations
pnpm migrate up --url-env OTHER_URL     # read the connection string from another variable
```

The connection string comes from `DATABASE_MIGRATION_URL` (the migration role over the session pooler or direct connection, never the application role) and is never printed. Exit codes: 0 ok, 1 problems or a failed migration, 2 the command could not run.

What `up` guarantees:

- Static problems stop the run before the database is touched.
- One advisory lock (`pg_advisory_lock`, waiting up to 60 seconds) serialises runs, so two deploys cannot migrate at once. It needs a session-level connection: the session pooler or direct, not the transaction pooler.
- Each migration and its ledger row commit in one transaction; a failure rolls both back and stops the run.
- The ledger (`gx_migrations.ledger`: package, name, checksum, phase, applied time, duration) must match the files: an edited or deleted applied migration, or an applied migration behind a pending one, refuses the run.
- Packages run in the order of their register `depends`, then by number.

## Public API

One file, `src/index.ts`, exported as `@gx/migrate`.

| Export | What it is |
|---|---|
| `migrate`, `MigrateOptions`, `MigrateReport`, `MigrateFailure`, `AppliedMigration` | Bring a database to head (or plan it) |
| `loadMigrations`, `Migration`, `MigrationSource`, `MigrationProblem`, `ProblemRule`, `Phase`, `LoadedMigrations` | Read and validate migration files without a database |
| `sourcesFromRegister` | One source per registered package |
| `findRiskyStatements`, `blankCommentsAndStrings`, `countStatements`, `Finding`, `StatementKind` | The SQL scanner |
| `LEDGER_TABLE`, `MIGRATION_LOCK_KEY` | Ledger table name and advisory lock key |
| `MODULE_ID` | This package's register id, `migrate` |

## Depends on

`@gx/core`; `pg` (the Postgres driver).

## Tests

```
pnpm vitest run --project migrate                                # unit tests, no database
GX_TEST_DATABASE_URL=postgresql://... pnpm test:db               # real Postgres; each test uses a fresh database
```

The database suite needs a role that can create databases, and fails loudly when `GX_TEST_DATABASE_URL` is missing. CI runs it against Postgres 17 (K0-T10).
