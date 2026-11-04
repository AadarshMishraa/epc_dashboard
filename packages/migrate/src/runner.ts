import { err, ok, type Result } from '@gx/core';
import pg from 'pg';
import {
  loadMigrations,
  type Migration,
  type MigrationProblem,
  type MigrationSource,
} from './migrations.ts';

/** Fixed key for the one advisory lock that serialises migration runs across processes. */
export const MIGRATION_LOCK_KEY = 4_712_003_005;
export const LEDGER_TABLE = 'gx_migrations.ledger';
const META_TABLE = 'gx_migrations.meta';
/** Shape of the ledger this runner writes; a newer ledger refuses an older runner. */
export const LEDGER_VERSION = 1;

const DEFAULTS = {
  /** Wait for another run to finish. */
  runLockTimeoutMs: 60_000,
  /** Wait for a table lock inside one migration; short, so app traffic never queues behind DDL. */
  migrationLockTimeoutMs: 5_000,
  /** Longest a single statement may run. */
  statementTimeoutMs: 10 * 60_000,
} as const;

/** Postgres SQLSTATE for "lock_not_available", raised when lock_timeout expires. */
const LOCK_NOT_AVAILABLE = '55P03';

export interface MigrateOptions {
  /** The migration role over a session-level connection (session pooler or direct). */
  readonly connectionString: string;
  readonly sources: readonly MigrationSource[];
  readonly runLockTimeoutMs?: number;
  readonly migrationLockTimeoutMs?: number;
  readonly statementTimeoutMs?: number;
  /** Release identifier (for example a git commit) recorded with each applied migration. */
  readonly release?: string;
  /** Report what would run; reads only, creates nothing. */
  readonly dryRun?: boolean;
}

export interface AppliedMigration {
  readonly packageId: string;
  readonly name: string;
  readonly durationMs: number;
}

export interface MigrateReport {
  readonly applied: readonly AppliedMigration[];
  readonly pending: readonly Pick<Migration, 'packageId' | 'name'>[];
  readonly alreadyApplied: number;
}

export type MigrateFailure =
  | { readonly kind: 'invalid'; readonly problems: readonly MigrationProblem[] }
  | { readonly kind: 'lock-timeout'; readonly message: string }
  | { readonly kind: 'ledger-mismatch'; readonly problems: readonly MigrationProblem[] }
  | { readonly kind: 'ledger-too-new'; readonly message: string }
  | { readonly kind: 'session-not-pinned'; readonly message: string }
  | { readonly kind: 'dirty'; readonly migrations: readonly string[]; readonly message: string }
  | {
      readonly kind: 'migration-failed';
      readonly packageId: string;
      readonly name: string;
      readonly sqlState: string | undefined;
      readonly message: string;
      readonly applied: readonly AppliedMigration[];
    };

interface LedgerRow {
  readonly package_id: string;
  readonly name: string;
  readonly checksum: string;
  readonly status: 'started' | 'applied';
}

/**
 * Brings the database to head, or reports what would run. One advisory lock serialises
 * runs; the static rules apply to pending migrations only, so a rule added later never
 * blocks a deploy over a file that is already applied. Each transactional migration
 * commits together with its ledger row. A `gx:no-transaction` migration records a
 * `started` row first; if the process dies before it completes, the next run stops as
 * dirty until an operator checks the object and clears the row (`forgetStarted`).
 */
export async function migrate(
  options: MigrateOptions,
): Promise<Result<MigrateReport, MigrateFailure>> {
  const timeouts = {
    runLock: positiveMs(options.runLockTimeoutMs ?? DEFAULTS.runLockTimeoutMs, 'runLockTimeoutMs'),
    migrationLock: positiveMs(
      options.migrationLockTimeoutMs ?? DEFAULTS.migrationLockTimeoutMs,
      'migrationLockTimeoutMs',
    ),
    statement: positiveMs(
      options.statementTimeoutMs ?? DEFAULTS.statementTimeoutMs,
      'statementTimeoutMs',
    ),
  };
  const { migrations, problems } = loadMigrations(options.sources);
  const general = problems.filter((p) => p.migration === undefined);
  if (general.length > 0) return err({ kind: 'invalid', problems: general });

  const client = new pg.Client({ connectionString: options.connectionString });
  await client.connect();
  try {
    // Ending the session releases the advisory lock, so no explicit unlock is needed.
    await setting(client, 'lock_timeout', timeouts.runLock);
    try {
      await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    } catch (error) {
      if (sqlStateOf(error) === LOCK_NOT_AVAILABLE) {
        return err({
          kind: 'lock-timeout',
          message: 'another migration run holds the lock; try again when it finishes',
        });
      }
      throw error;
    }
    const pid = await backendPid(client);
    const rows = await readLedger(client);
    if (!rows.ok) return rows;

    const dirty = rows.value.filter((row) => row.status === 'started');
    if (dirty.length > 0) {
      const names = dirty.map((row) => key(row.package_id, row.name));
      return err({
        kind: 'dirty',
        migrations: names,
        message: `${names.join(', ')} started but did not finish. Check the object it creates (for an index: SELECT indisvalid FROM pg_index ...), drop it if it is invalid, then run gx-migrate forget-started <package/name> and migrate again`,
      });
    }
    const mismatches = compareLedger(rows.value, migrations);
    if (mismatches.length > 0) return err({ kind: 'ledger-mismatch', problems: mismatches });

    const appliedKeys = new Set(rows.value.map((row) => key(row.package_id, row.name)));
    const pending = migrations.filter((m) => !appliedKeys.has(key(m.packageId, m.name)));
    const pendingKeys = new Set(pending.map((m) => key(m.packageId, m.name)));
    const blocking = problems.filter(
      (p) => p.migration !== undefined && pendingKeys.has(p.migration),
    );
    if (blocking.length > 0) return err({ kind: 'invalid', problems: blocking });

    const report = {
      pending: pending.map(({ packageId, name }) => ({ packageId, name })),
      alreadyApplied: rows.value.length,
    };
    if (options.dryRun === true || pending.length === 0) return ok({ applied: [], ...report });

    await bootstrapLedger(client);
    const applied: AppliedMigration[] = [];
    for (const migration of pending) {
      if ((await backendPid(client)) !== pid) {
        return err({
          kind: 'session-not-pinned',
          message:
            'the database session changed between statements: use the session pooler (port 5432) or a direct connection, not the transaction pooler',
        });
      }
      const outcome = await applyOne(client, migration, timeouts, options.release);
      if (!outcome.ok) {
        return err({
          kind: 'migration-failed',
          packageId: migration.packageId,
          name: migration.name,
          ...outcome.error,
          applied,
        });
      }
      applied.push({
        packageId: migration.packageId,
        name: migration.name,
        durationMs: outcome.value,
      });
    }
    return ok({ applied, ...report });
  } finally {
    await client.end();
  }
}

/** Removes a `started` row after an operator has checked or cleaned up its object. */
export async function forgetStarted(
  connectionString: string,
  migration: string,
): Promise<Result<undefined, { readonly message: string }>> {
  const [packageId, name] = migration.split('/');
  if (packageId === undefined || name === undefined) {
    return err({ message: 'name the migration as package/name' });
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      `DELETE FROM ${LEDGER_TABLE} WHERE package_id = $1 AND name = $2 AND status = 'started'`,
      [packageId, name],
    );
    return rowCount === 1 ? ok(undefined) : err({ message: `${migration} has no started row` });
  } finally {
    await client.end();
  }
}

async function applyOne(
  client: pg.Client,
  migration: Migration,
  timeouts: { readonly migrationLock: number; readonly statement: number },
  release: string | undefined,
): Promise<Result<number, { readonly sqlState: string | undefined; readonly message: string }>> {
  const started = performance.now();
  const values = [
    migration.packageId,
    migration.name,
    migration.checksum,
    migration.phase,
    release ?? null,
  ];
  try {
    // A fresh session state for every migration: nothing one file SETs leaks into the next.
    await client.query('RESET ALL');
    await setting(client, 'lock_timeout', timeouts.migrationLock);
    await setting(client, 'statement_timeout', timeouts.statement);
    if (migration.transactional) {
      await client.query('BEGIN');
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO ${LEDGER_TABLE} (package_id, name, checksum, phase, release, status, applied_at, duration_ms)
         VALUES ($1, $2, $3, $4, $5, 'applied', now(), $6)`,
        [...values, Math.round(performance.now() - started)],
      );
      await client.query('COMMIT');
    } else {
      await client.query(
        `INSERT INTO ${LEDGER_TABLE} (package_id, name, checksum, phase, release, status)
         VALUES ($1, $2, $3, $4, $5, 'started')`,
        values,
      );
      await client.query(migration.sql);
      await client.query(
        `UPDATE ${LEDGER_TABLE} SET status = 'applied', applied_at = now(), duration_ms = $3
         WHERE package_id = $1 AND name = $2`,
        [migration.packageId, migration.name, Math.round(performance.now() - started)],
      );
    }
    return ok(Math.round(performance.now() - started));
  } catch (error) {
    if (migration.transactional) {
      // Report the original error. If ROLLBACK itself fails the session is gone, and a
      // closed session rolls back on the server anyway.
      await client.query('ROLLBACK').catch(() => undefined);
    }
    const sqlState = sqlStateOf(error);
    const message = error instanceof Error ? error.message : String(error);
    return err({
      sqlState,
      message:
        sqlState === LOCK_NOT_AVAILABLE
          ? `${message}: a table it changes is busy; retry when traffic is lower, or make the change take a lighter lock`
          : message,
    });
  }
}

async function readLedger(client: pg.Client): Promise<Result<LedgerRow[], MigrateFailure>> {
  const exists = await client.query<{ present: boolean }>(
    'SELECT to_regclass($1) IS NOT NULL AS present',
    [META_TABLE],
  );
  if (exists.rows[0]?.present !== true) return ok([]);
  const version = await client.query<{ value: string }>(
    `SELECT value FROM ${META_TABLE} WHERE key = 'ledger_version'`,
  );
  const current = Number(version.rows[0]?.value ?? '0');
  if (current > LEDGER_VERSION) {
    return err({
      kind: 'ledger-too-new',
      message: `the ledger is version ${String(current)}, newer than this runner (${String(LEDGER_VERSION)}); deploy the newer runner`,
    });
  }
  if (current < 1) return ok([]);
  const ledger = await client.query<LedgerRow>(
    `SELECT package_id, name, checksum, status FROM ${LEDGER_TABLE} ORDER BY id`,
  );
  return ok(ledger.rows);
}

/** Creates or upgrades the ledger; each version is one step, applied once, in a transaction. */
async function bootstrapLedger(client: pg.Client): Promise<void> {
  await client.query('CREATE SCHEMA IF NOT EXISTS gx_migrations');
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${META_TABLE} (key text PRIMARY KEY, value text NOT NULL)`,
  );
  const { rows } = await client.query<{ value: string }>(
    `SELECT value FROM ${META_TABLE} WHERE key = 'ledger_version'`,
  );
  if (Number(rows[0]?.value ?? '0') >= 1) return;
  await client.query('BEGIN');
  await client.query(`
    CREATE TABLE ${LEDGER_TABLE} (
      id          bigserial   PRIMARY KEY,
      package_id  text        NOT NULL,
      name        text        NOT NULL,
      checksum    text        NOT NULL,
      phase       text        NOT NULL CHECK (phase IN ('expand', 'contract')),
      status      text        NOT NULL CHECK (status IN ('started', 'applied')),
      release     text,
      applied_by  text        NOT NULL DEFAULT current_user,
      started_at  timestamptz NOT NULL DEFAULT now(),
      applied_at  timestamptz,
      duration_ms integer,
      UNIQUE (package_id, name)
    )`);
  await client.query(`INSERT INTO ${META_TABLE} (key, value) VALUES ('ledger_version', '1')`);
  await client.query('COMMIT');
}

/** Applied history must match the files: same checksum, nothing missing, no holes. */
function compareLedger(
  rows: readonly LedgerRow[],
  migrations: readonly Migration[],
): MigrationProblem[] {
  const problems: MigrationProblem[] = [];
  const byKey = new Map(migrations.map((m) => [key(m.packageId, m.name), m]));
  const appliedByPackage = new Map<string, Set<string>>();
  for (const row of rows) {
    const migration = byKey.get(key(row.package_id, row.name));
    if (migration === undefined) {
      problems.push({
        rule: 'ledger',
        message: `${key(row.package_id, row.name)} is applied but its file is gone; migrations are never deleted`,
      });
    } else if (migration.checksum !== row.checksum) {
      problems.push({
        rule: 'ledger',
        file: migration.file,
        message:
          'this migration changed after it was applied; never edit an applied migration, add a new one',
      });
    }
    const set = appliedByPackage.get(row.package_id) ?? new Set<string>();
    set.add(row.name);
    appliedByPackage.set(row.package_id, set);
  }
  const byPackage = new Map<string, Migration[]>();
  for (const migration of migrations) {
    const list = byPackage.get(migration.packageId) ?? [];
    list.push(migration);
    byPackage.set(migration.packageId, list);
  }
  for (const [packageId, list] of byPackage) {
    const applied = appliedByPackage.get(packageId) ?? new Set<string>();
    const firstPending = list.findIndex((m) => !applied.has(m.name));
    if (firstPending === -1) continue;
    const later = list.slice(firstPending + 1).find((m) => applied.has(m.name));
    if (later !== undefined) {
      problems.push({
        rule: 'ledger',
        file: list[firstPending]?.file ?? later.file,
        message: `this migration is not applied but ${later.name} after it is; migrations are forward-only, so renumber it after the last applied one`,
      });
    }
  }
  return problems;
}

async function setting(
  client: pg.Client,
  name: 'lock_timeout' | 'statement_timeout',
  ms: number,
): Promise<void> {
  await client.query('SELECT set_config($1, $2, false)', [name, `${String(ms)}ms`]);
}

async function backendPid(client: pg.Client): Promise<number> {
  const { rows } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
  return rows[0]?.pid ?? -1;
}

function positiveMs(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive whole number of milliseconds`);
  }
  return value;
}

const key = (packageId: string, name: string): string => `${packageId}/${name}`;

function sqlStateOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}
