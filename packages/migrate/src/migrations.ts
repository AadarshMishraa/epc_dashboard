import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { countStatements, findRiskyStatements, type StatementKind } from './sql-scan.ts';

/** Where one package keeps its migrations, and which packages' migrations must run first. */
export interface MigrationSource {
  readonly packageId: string;
  /** Absolute path of the package's `migrations/` directory (may not exist). */
  readonly dir: string;
  readonly depends: readonly string[];
  /** Repository-relative path for messages, for example `packages/k1-tenancy/migrations`. */
  readonly displayDir: string;
}

export type Phase = 'expand' | 'contract';

export interface Migration {
  readonly packageId: string;
  /** File name without `.sql`, for example `0001_create_tenant`. Unique within the package. */
  readonly name: string;
  readonly number: number;
  readonly file: string;
  readonly sql: string;
  /** SHA-256 of the file; an applied migration must never change. */
  readonly checksum: string;
  readonly phase: Phase;
  readonly transactional: boolean;
  readonly reason?: string;
}

export type ProblemRule =
  | 'file-name'
  | 'numbering'
  | 'directive'
  | 'destructive-without-contract'
  | 'transaction-control'
  | 'no-transaction-multi-statement'
  | 'dependency'
  | 'ledger'
  | 'empty';

export interface MigrationProblem {
  readonly rule: ProblemRule;
  readonly file?: string;
  readonly line?: number;
  readonly message: string;
}

const FILE_NAME = /^(\d{4})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/;
const DIRECTIVE = /^--\s*gx:([a-z-]+)(?:\s+(.*))?$/;
const DESCRIPTIONS: Readonly<Record<StatementKind, string>> = {
  drop: 'DROP removes something the previous release may still use',
  rename: 'RENAME breaks the previous release; add the new name, copy, then drop later',
  'type-change': 'a column type change can break the previous release',
  'set-not-null': 'SET NOT NULL breaks writers of the previous release',
  'add-not-null-without-default':
    'a NOT NULL column without a default breaks writers of the previous release',
  delete: 'DELETE destroys data; backfills and clean-ups run as tenant-aware jobs',
  truncate: 'TRUNCATE destroys data',
  update: 'UPDATE rewrites data; backfills run as tenant-aware jobs',
  'transaction-control':
    'the runner owns transactions; remove BEGIN, COMMIT, ROLLBACK or SAVEPOINT',
};

export interface LoadedMigrations {
  readonly migrations: readonly Migration[];
  readonly problems: readonly MigrationProblem[];
}

/**
 * Reads every source, validates each file on its own and against its package's sequence,
 * and returns the migrations in run order: packages in dependency order, then by number.
 */
export function loadMigrations(sources: readonly MigrationSource[]): LoadedMigrations {
  const problems: MigrationProblem[] = [];
  const order = dependencyOrder(sources, problems);
  const migrations: Migration[] = [];
  for (const source of order) {
    migrations.push(...loadPackage(source, problems));
  }
  return { migrations, problems };
}

function loadPackage(source: MigrationSource, problems: MigrationProblem[]): Migration[] {
  if (!existsSync(source.dir)) return [];
  const files = readdirSync(source.dir)
    .filter((name) => !name.startsWith('.'))
    .sort();
  const loaded: Migration[] = [];
  for (const fileName of files) {
    const file = `${source.displayDir}/${fileName}`;
    const match = FILE_NAME.exec(fileName);
    if (match?.[1] === undefined) {
      problems.push({
        rule: 'file-name',
        file,
        message:
          'migration files are named NNNN_lowercase_words.sql, for example 0001_create_tenant.sql',
      });
      continue;
    }
    const sql = readFileSync(join(source.dir, fileName), 'utf8');
    const migration = parseMigration(
      source.packageId,
      fileName,
      Number(match[1]),
      sql,
      file,
      problems,
    );
    if (migration !== undefined) loaded.push(migration);
  }
  // Forward-only and gap-free: 0001, 0002, 0003 ... so a merged branch cannot slip in behind.
  loaded.forEach((migration, index) => {
    if (migration.number !== index + 1) {
      problems.push({
        rule: 'numbering',
        file: migration.file,
        message: `expected number ${String(index + 1).padStart(4, '0')} here; numbers start at 0001 with no gaps or duplicates`,
      });
    }
  });
  return loaded;
}

function parseMigration(
  packageId: string,
  fileName: string,
  number: number,
  sql: string,
  file: string,
  problems: MigrationProblem[],
): Migration | undefined {
  let phase: Phase = 'expand';
  let transactional = true;
  let reason: string | undefined;
  const lines = sql.split('\n');
  for (const [index, raw] of lines.entries()) {
    const directive = DIRECTIVE.exec(raw.trim());
    if (directive === null) continue;
    const [, key, value = ''] = directive;
    const line = index + 1;
    if (key === 'phase' && (value === 'expand' || value === 'contract')) phase = value;
    else if (key === 'no-transaction' && value === '') transactional = false;
    else if (key === 'reason' && value.trim() !== '') reason = value.trim();
    else {
      problems.push({
        rule: 'directive',
        file,
        line,
        message: `unknown or malformed directive '${raw.trim()}'; use gx:phase expand|contract, gx:reason <text>, gx:no-transaction`,
      });
    }
  }

  if (countStatements(sql) === 0) {
    problems.push({ rule: 'empty', file, message: 'the migration has no statements' });
    return undefined;
  }
  if (phase === 'contract' && reason === undefined) {
    problems.push({
      rule: 'directive',
      file,
      message:
        'a contract migration needs -- gx:reason <what it removes and which release stopped using it>',
    });
  }
  if (!transactional && countStatements(sql) !== 1) {
    problems.push({
      rule: 'no-transaction-multi-statement',
      file,
      message: 'a gx:no-transaction migration must hold exactly one statement',
    });
  }
  for (const finding of findRiskyStatements(sql)) {
    if (finding.kind === 'transaction-control') {
      problems.push({
        rule: 'transaction-control',
        file,
        line: finding.line,
        message: DESCRIPTIONS[finding.kind],
      });
    } else if (phase !== 'contract') {
      problems.push({
        rule: 'destructive-without-contract',
        file,
        line: finding.line,
        message: `${DESCRIPTIONS[finding.kind]} ('${finding.text}'). Expand first; do this in a later migration marked -- gx:phase contract with a gx:reason`,
      });
    }
  }

  return {
    packageId,
    name: fileName.replace(/\.sql$/, ''),
    number,
    file,
    sql,
    checksum: createHash('sha256').update(sql).digest('hex'),
    phase,
    transactional,
    ...(reason === undefined ? {} : { reason }),
  };
}

/** Kahn's algorithm; ties break by package id so the order is stable. */
function dependencyOrder(
  sources: readonly MigrationSource[],
  problems: MigrationProblem[],
): MigrationSource[] {
  const byId = new Map(sources.map((source) => [source.packageId, source]));
  const remaining = new Map<string, Set<string>>();
  for (const source of sources) {
    const deps = new Set<string>();
    for (const dep of source.depends) {
      if (byId.has(dep)) deps.add(dep);
      else {
        problems.push({
          rule: 'dependency',
          message: `${source.packageId} depends on ${dep}, which has no migration source`,
        });
      }
    }
    remaining.set(source.packageId, deps);
  }
  const ordered: MigrationSource[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter(([, deps]) => deps.size === 0)
      .map(([id]) => id)
      .sort();
    if (ready.length === 0) {
      problems.push({
        rule: 'dependency',
        message: `dependency cycle between ${[...remaining.keys()].sort().join(', ')}`,
      });
      break;
    }
    for (const id of ready) {
      remaining.delete(id);
      for (const deps of remaining.values()) deps.delete(id);
      const source = byId.get(id);
      if (source !== undefined) ordered.push(source);
    }
  }
  return ordered;
}
