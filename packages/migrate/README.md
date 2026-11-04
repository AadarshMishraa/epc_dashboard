# @gx/migrate

Migration framework: package-namespaced, forward-only, expand then contract, run in dependency order with a checksum ledger.

- Plan: [K0 brief](../../docs/plans/001-foundation/K0-core.md), K0-T05, wave 0. Support package in the core lane (not a module).
- Register id: `migrate` in [packages/register.json](../register.json).

## Writing a migration

Each package keeps plain SQL in `packages/<package>/migrations/`, numbered from `0001` with no gaps: `0001_create_tenant.sql`, `0002_add_region.sql`. Tables use the package prefix (`k1_`); the boundary lint (K0-T08) enforces ownership.

| Directive (a comment line) | Meaning |
|---|---|
| none | `expand` phase: additive only. The previous release must keep working on the new schema |
| `-- gx:phase contract` | Allowed to remove, rewrite or tighten. Needs `-- gx:reason <what it removes; which release stopped using it>` |
| `-- gx:security-reviewed <reason and reviewer>` | Required, in any phase, for statements that can weaken isolation or privileges |
| `-- gx:no-transaction` | Runs outside a transaction, for `CREATE INDEX CONCURRENTLY`. Exactly one statement; make it idempotent (`IF NOT EXISTS`) |

Each statement is judged by an allow-list, not a deny-list:

| Class | Statements |
|---|---|
| Safe (expand) | `CREATE TABLE`, `CREATE [UNIQUE] INDEX`, `CREATE TYPE / SEQUENCE / SCHEMA / DOMAIN`, `CREATE [OR REPLACE] FUNCTION / PROCEDURE / VIEW / TRIGGER`, `COMMENT ON`, `INSERT INTO`, `ALTER TYPE ... ADD VALUE`, `GRANT ... ON <object> TO gx_app`; `ALTER TABLE` actions `ADD COLUMN` (nullable, defaulted or generated), `ADD CONSTRAINT ... NOT VALID`, `VALIDATE CONSTRAINT`, `ENABLE / FORCE ROW LEVEL SECURITY`, `DROP NOT NULL`, `SET DEFAULT`. A table created in the same file can be shaped freely |
| Contract | Everything else, including `DROP`, `RENAME`, type changes, `SET NOT NULL`, new constraints on existing tables without `NOT VALID`, `SET SCHEMA`, `SET UNLOGGED`, `DETACH PARTITION`, `REVOKE`, `UPDATE`, `DELETE`, `MERGE`, `TRUNCATE`, `COPY` and any unlisted statement |
| Security (needs review) | `DISABLE` or `NO FORCE ROW LEVEL SECURITY`, any `POLICY` statement, roles and `BYPASSRLS`, `SECURITY DEFINER`, `SET ROLE` and `SET SESSION AUTHORIZATION`, `DO` blocks, `OWNER TO`, `ALTER DEFAULT PRIVILEGES`, extensions, schema- or database-wide grants, grants to other roles or `WITH GRANT OPTION`, role membership |
| Forbidden | `BEGIN`, `START TRANSACTION`, `COMMIT`, `END`, `ROLLBACK`, `ABORT`, `SAVEPOINT`, `RELEASE`, two-phase commit |

Keywords inside comments, strings (including `E''` escapes), quoted identifiers and dollar-quoted bodies are ignored. Write function bodies with `$$`, not `BEGIN ATOMIC`.

Packages run one after another in register order, which is safe because no package touches another's tables. A contract migration must not remove anything another package's migrations reference (for example a shared role); if that need arises, it needs an ordering edge first.

Never edit or delete an applied migration; rollback is a forward fix.

## Running

```
pnpm migrate check                      # validate files; no database (CI and pre-commit)
pnpm migrate plan                       # pending migrations, applies nothing
pnpm migrate up                         # apply pending migrations
pnpm migrate up --url-env OTHER_URL     # read the connection string from another variable
pnpm migrate forget-started a/0003_x    # clear a dirty no-transaction migration after checking it
```

The connection string comes from `DATABASE_MIGRATION_URL` (the migration role over the session pooler or direct connection, never the application role) and is never printed. Exit codes: 0 ok, 1 problems or a failed migration, 2 the command could not run.

What `up` guarantees:

- Problems in pending files stop the run before anything is written. Files already applied are not re-judged, so a rule added later never blocks a deploy or a boot.
- One advisory lock (`pg_advisory_lock`, waiting up to 60 seconds) serialises runs. It needs a session-level connection: the runner checks that the session never changes and refuses a transaction pooler.
- Each migration gets fresh session settings (`RESET ALL`), a 5-second lock timeout (a busy table fails fast instead of queueing app traffic behind DDL) and a 10-minute statement timeout.
- Each transactional migration and its ledger row commit together; a failure rolls both back and stops the run.
- A `gx:no-transaction` migration writes a `started` row first. If it does not finish, the next run stops as dirty: check the object it creates (for an index, `pg_index.indisvalid`), drop it if invalid, then `pnpm migrate forget-started <package/name>`.
- The ledger (`gx_migrations.ledger`: id, package, name, checksum, phase, status, release from `GX_RELEASE`, applied_by, started and applied times, duration; version in `gx_migrations.meta`) must match the files: an edited or deleted applied migration, or an applied migration behind a pending one, refuses the run. A ledger newer than the runner is refused.
- `plan` reads only; it creates nothing.

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
