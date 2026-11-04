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
const DEFAULT_LOCK_TIMEOUT_MS = 60_000;
/** Postgres SQLSTATE for "lock_not_available", raised when lock_timeout expires. */
const LOCK_NOT_AVAILABLE = '55P03';

export interface MigrateOptions {
  /** The migration role's connection (session pooler or direct), never the app role's. */
  readonly connectionString: string;
  readonly sources: readonly MigrationSource[];
  /** How long to wait for another run to finish before giving up. */
  readonly lockTimeoutMs?: number;
  /** Report what would run without applying anything. */
  readonly dryRun?: boolean;
}

export interface AppliedMigration {
  readonly packageId: string;
  readonly name: string;
  readonly durationMs: number;
}

export interface MigrateReport {
  readonly applied: readonly AppliedMigration[];
  /** Pending migrations, in run order; on a dry run nothing was applied. */
  readonly pending: readonly Pick<Migration, 'packageId' | 'name'>[];
  readonly alreadyApplied: number;
}

export type MigrateFailure =
  | { readonly kind: 'invalid'; readonly problems: readonly MigrationProblem[] }
  | { readonly kind: 'lock-timeout'; readonly message: string }
  | { readonly kind: 'ledger-mismatch'; readonly problems: readonly MigrationProblem[] }
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
}

/**
 * Brings the database to head. Static problems stop the run before the database is
 * touched. One advisory lock means two deploys cannot migrate at once; each migration and
 * its ledger row commit together, so a failure leaves the ledger true.
 */
export async function migrate(
  options: MigrateOptions,
): Promise<Result<MigrateReport, MigrateFailure>> {
  const { migrations, problems } = loadMigrations(options.sources);
  if (problems.length > 0) return err({ kind: 'invalid', problems });

  const client = new pg.Client({ connectionString: options.connectionString });
  await client.connect();
  try {
    await client.query(
      `SET lock_timeout = ${String(Math.trunc(options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS))}`,
    );
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
    try {
      await client.query('SET lock_timeout = 0');
      return await migrateLocked(client, migrations, options.dryRun === true);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    }
  } finally {
    await client.end();
  }
}

async function migrateLocked(
  client: pg.Client,
  migrations: readonly Migration[],
  dryRun: boolean,
): Promise<Result<MigrateReport, MigrateFailure>> {
  await client.query('CREATE SCHEMA IF NOT EXISTS gx_migrations');
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
      package_id  text        NOT NULL,
      name        text        NOT NULL,
      checksum    text        NOT NULL,
      phase       text        NOT NULL CHECK (phase IN ('expand', 'contract')),
      applied_at  timestamptz NOT NULL DEFAULT now(),
      duration_ms integer     NOT NULL,
      PRIMARY KEY (package_id, name)
    )`);
  const { rows } = await client.query<LedgerRow>(
    `SELECT package_id, name, checksum FROM ${LEDGER_TABLE}`,
  );

  const mismatches = compareLedger(rows, migrations);
  if (mismatches.length > 0) return err({ kind: 'ledger-mismatch', problems: mismatches });

  const appliedKeys = new Set(rows.map((row) => `${row.package_id}/${row.name}`));
  const pending = migrations.filter((m) => !appliedKeys.has(`${m.packageId}/${m.name}`));
  const pendingNames = pending.map(({ packageId, name }) => ({ packageId, name }));
  if (dryRun) return ok({ applied: [], pending: pendingNames, alreadyApplied: rows.length });

  const applied: AppliedMigration[] = [];
  for (const migration of pending) {
    const started = performance.now();
    try {
      if (migration.transactional) await client.query('BEGIN');
      await client.query(migration.sql);
      const durationMs = Math.round(performance.now() - started);
      await client.query(
        `INSERT INTO ${LEDGER_TABLE} (package_id, name, checksum, phase, duration_ms) VALUES ($1, $2, $3, $4, $5)`,
        [migration.packageId, migration.name, migration.checksum, migration.phase, durationMs],
      );
      if (migration.transactional) await client.query('COMMIT');
      applied.push({ packageId: migration.packageId, name: migration.name, durationMs });
    } catch (error) {
      if (migration.transactional) await client.query('ROLLBACK');
      return err({
        kind: 'migration-failed',
        packageId: migration.packageId,
        name: migration.name,
        sqlState: sqlStateOf(error),
        message: error instanceof Error ? error.message : String(error),
        applied,
      });
    }
  }
  return ok({ applied, pending: pendingNames, alreadyApplied: rows.length });
}

/** Applied history must match the files exactly: same checksum, nothing missing, no holes. */
function compareLedger(
  rows: readonly LedgerRow[],
  migrations: readonly Migration[],
): MigrationProblem[] {
  const problems: MigrationProblem[] = [];
  const byKey = new Map(migrations.map((m) => [`${m.packageId}/${m.name}`, m]));
  const appliedByPackage = new Map<string, Set<string>>();
  for (const row of rows) {
    const migration = byKey.get(`${row.package_id}/${row.name}`);
    if (migration === undefined) {
      problems.push({
        rule: 'ledger',
        message: `${row.package_id}/${row.name} is applied but its file is gone; migrations are never deleted`,
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
  // Within a package, applied migrations must be a prefix of the files: nothing pending behind an applied one.
  const byPackage = new Map<string, Migration[]>();
  for (const migration of migrations) {
    byPackage.set(migration.packageId, [...(byPackage.get(migration.packageId) ?? []), migration]);
  }
  for (const [packageId, list] of byPackage) {
    const applied = appliedByPackage.get(packageId) ?? new Set<string>();
    const firstPending = list.findIndex((m) => !applied.has(m.name));
    if (firstPending === -1) continue;
    for (const later of list.slice(firstPending + 1)) {
      if (applied.has(later.name)) {
        problems.push({
          rule: 'ledger',
          file: list[firstPending]?.file ?? later.file,
          message: `this migration is not applied but ${later.name} after it is; migrations are forward-only, so renumber it after the last applied one`,
        });
        break;
      }
    }
  }
  return problems;
}

function sqlStateOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}
