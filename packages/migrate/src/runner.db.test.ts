import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { MigrationSource } from './migrations.ts';
import { LEDGER_TABLE, MIGRATION_LOCK_KEY, forgetStarted, migrate } from './runner.ts';

// Each test gets its own empty database on the server named by GX_TEST_DATABASE_URL.
const adminUrl = process.env['GX_TEST_DATABASE_URL'];
const created: { name: string; root: string }[] = [];
let admin: pg.Client;

beforeAll(async () => {
  if (adminUrl === undefined || adminUrl === '') {
    throw new Error(
      'GX_TEST_DATABASE_URL is not set: database tests need a Postgres the test role can create databases on',
    );
  }
  admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
});

afterEach(async () => {
  for (const { name, root } of created.splice(0)) {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    rmSync(root, { recursive: true, force: true });
  }
});

afterAll(async () => {
  await admin.end();
});

interface Fixture {
  readonly url: string;
  readonly root: string;
  sources(
    packages: Record<string, { files?: Record<string, string>; depends?: string[] }>,
  ): MigrationSource[];
  query<T extends pg.QueryResultRow>(sql: string): Promise<T[]>;
}

async function fixture(): Promise<Fixture> {
  const name = `gx_t_${randomBytes(6).toString('hex')}`;
  const root = mkdtempSync(join(tmpdir(), 'gx-migrate-db-'));
  created.push({ name, root });
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(adminUrl ?? '');
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    root,
    sources(packages) {
      return Object.entries(packages).map(([packageId, { files, depends = [] }]) => {
        const dir = join(root, 'packages', packageId, 'migrations');
        mkdirSync(dir, { recursive: true });
        for (const [file, sql] of Object.entries(files ?? {})) writeFileSync(join(dir, file), sql);
        return { packageId, dir, depends, displayDir: `packages/${packageId}/migrations` };
      });
    },
    async query<T extends pg.QueryResultRow>(sql: string) {
      const client = new pg.Client({ connectionString: url.toString() });
      await client.connect();
      try {
        return (await client.query<T>(sql)).rows;
      } finally {
        await client.end();
      }
    },
  };
}

const TWO_PACKAGES = {
  'k6-events': {
    depends: ['k1-tenancy'],
    files: {
      '0001_create_outbox.sql':
        'CREATE TABLE k6_outbox (id uuid PRIMARY KEY, tenant_id uuid NOT NULL);',
    },
  },
  'k1-tenancy': {
    files: {
      '0001_create_tenant.sql': 'CREATE TABLE k1_tenant (id uuid PRIMARY KEY);',
      '0002_add_region.sql': 'ALTER TABLE k1_tenant ADD COLUMN region text;',
    },
  },
};

const ledger = (db: Fixture) =>
  db.query<{ package_id: string; name: string }>(
    `SELECT package_id, name FROM ${LEDGER_TABLE} ORDER BY applied_at, package_id, name`,
  );

describe('migrate from empty', () => {
  it('applies 2 packages in dependency order in 1 pass, and the ledger lists each once (F-03-AC1)', async () => {
    const db = await fixture();
    const result = await migrate({ connectionString: db.url, sources: db.sources(TWO_PACKAGES) });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.applied.map((m) => `${m.packageId}/${m.name}`)).toEqual([
      'k1-tenancy/0001_create_tenant',
      'k1-tenancy/0002_add_region',
      'k6-events/0001_create_outbox',
    ]);
    const rows = await ledger(db);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => `${r.package_id}/${r.name}`)).size).toBe(3);
    const columns = await db.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'k1_tenant' ORDER BY column_name",
    );
    expect(columns.map((c) => c.column_name)).toEqual(['id', 'region']);
  });

  it('is a no-op the second time', async () => {
    const db = await fixture();
    const sources = db.sources(TWO_PACKAGES);
    await migrate({ connectionString: db.url, sources });
    const again = await migrate({ connectionString: db.url, sources });
    expect(again.ok && again.value).toEqual({ applied: [], pending: [], alreadyApplied: 3 });
    expect(await ledger(db)).toHaveLength(3);
  });

  it('applies only the new migration after a release adds one', async () => {
    const db = await fixture();
    const sources = db.sources(TWO_PACKAGES);
    await migrate({ connectionString: db.url, sources });
    writeFileSync(
      join(db.root, 'packages/k1-tenancy/migrations/0003_add_timezone.sql'),
      'ALTER TABLE k1_tenant ADD COLUMN timezone text;',
    );
    const next = await migrate({ connectionString: db.url, sources });
    expect(next.ok && next.value.applied.map((m) => m.name)).toEqual(['0003_add_timezone']);
  });

  it('reports pending migrations on a dry run and applies nothing', async () => {
    const db = await fixture();
    const result = await migrate({
      connectionString: db.url,
      sources: db.sources(TWO_PACKAGES),
      dryRun: true,
    });
    expect(result.ok && result.value.pending).toHaveLength(3);
    expect(
      await db.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'k1_tenant'"),
    ).toEqual([]);
  });
});

describe('refusals', () => {
  it('rejects a destructive step without a contract marker before touching the database', async () => {
    const db = await fixture();
    const result = await migrate({
      connectionString: db.url,
      sources: db.sources({
        a: { files: { '0001_a.sql': 'CREATE TABLE a_u (c int);\nALTER TABLE a_t DROP COLUMN c;' } },
      }),
    });
    expect(!result.ok && result.error.kind).toBe('invalid');
    expect(
      await db.query(
        "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'gx_migrations'",
      ),
    ).toEqual([]);
  });

  it('refuses when an applied migration was edited', async () => {
    const db = await fixture();
    const sources = db.sources(TWO_PACKAGES);
    await migrate({ connectionString: db.url, sources });
    writeFileSync(
      join(db.root, 'packages/k1-tenancy/migrations/0002_add_region.sql'),
      'ALTER TABLE k1_tenant ADD COLUMN region varchar(10);',
    );
    const result = await migrate({ connectionString: db.url, sources });
    expect(!result.ok && result.error.kind).toBe('ledger-mismatch');
    expect(
      !result.ok && result.error.kind === 'ledger-mismatch' && result.error.problems[0]?.message,
    ).toContain('changed after it was applied');
  });

  it('refuses when an applied migration file was deleted', async () => {
    const db = await fixture();
    const sources = db.sources(TWO_PACKAGES);
    await migrate({ connectionString: db.url, sources });
    unlinkSync(join(db.root, 'packages/k6-events/migrations/0001_create_outbox.sql'));
    const result = await migrate({ connectionString: db.url, sources });
    expect(!result.ok && result.error.kind).toBe('ledger-mismatch');
  });

  it('refuses a history with a hole: a later migration applied before an earlier one', async () => {
    const db = await fixture();
    const sources = db.sources(TWO_PACKAGES);
    await migrate({ connectionString: db.url, sources });
    await db.query(
      `DELETE FROM ${LEDGER_TABLE} WHERE package_id = 'k1-tenancy' AND name = '0001_create_tenant'`,
    );
    const result = await migrate({ connectionString: db.url, sources });
    expect(
      !result.ok &&
        result.error.kind === 'ledger-mismatch' &&
        result.error.problems.map((p) => p.message).join(),
    ).toContain('forward-only');
  });
});

describe('failure handling', () => {
  it('rolls back a failing migration and keeps the ledger true', async () => {
    const db = await fixture();
    const result = await migrate({
      connectionString: db.url,
      sources: db.sources({
        a: {
          files: {
            '0001_ok.sql': 'CREATE TABLE a_one (id int);',
            '0002_bad.sql': 'CREATE TABLE a_two (id int);\nCREATE TABLE a_two (id int);',
            '0003_never.sql': 'CREATE TABLE a_three (id int);',
          },
        },
      }),
    });
    expect(!result.ok && result.error).toMatchObject({
      kind: 'migration-failed',
      name: '0002_bad',
      sqlState: '42P07',
    });
    expect((await ledger(db)).map((r) => r.name)).toEqual(['0001_ok']);
    const tables = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'a\\_%' ORDER BY 1",
    );
    expect(tables.map((t) => t.table_name)).toEqual(['a_one']);
  });

  it('commits a migration and its ledger row together: if the row fails, the change rolls back', async () => {
    const db = await fixture();
    // Fault injection: the migration itself makes its own ledger insert fail.
    const sql = [
      'CREATE TABLE a_one (id int);',
      "ALTER TABLE gx_migrations.ledger ADD CONSTRAINT gx_test_block CHECK (name <> '0001_block') NOT VALID;",
    ].join('\n');
    const result = await migrate({
      connectionString: db.url,
      sources: db.sources({ a: { files: { '0001_block.sql': sql } } }),
    });
    expect(!result.ok && result.error).toMatchObject({
      kind: 'migration-failed',
      name: '0001_block',
      sqlState: '23514',
    });
    expect(
      await db.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'a_one'"),
    ).toEqual([]);
    expect(await ledger(db)).toEqual([]);
  });

  it('lets two concurrent runs apply each migration exactly once', async () => {
    const db = await fixture();
    const sources = db.sources(TWO_PACKAGES);
    const [first, second] = await Promise.all([
      migrate({ connectionString: db.url, sources }),
      migrate({ connectionString: db.url, sources }),
    ]);
    expect(first.ok && second.ok).toBe(true);
    const appliedTotal =
      (first.ok ? first.value.applied.length : 0) + (second.ok ? second.value.applied.length : 0);
    expect(appliedTotal).toBe(3);
    expect(await ledger(db)).toHaveLength(3);
  });

  it('gives up with lock-timeout while another run holds the lock', async () => {
    const db = await fixture();
    const holder = new pg.Client({ connectionString: db.url });
    await holder.connect();
    try {
      await holder.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
      const result = await migrate({
        connectionString: db.url,
        sources: db.sources(TWO_PACKAGES),
        runLockTimeoutMs: 200,
      });
      expect(!result.ok && result.error.kind).toBe('lock-timeout');
    } finally {
      await holder.end();
    }
  });
});

describe('gx:no-transaction', () => {
  it('runs CREATE INDEX CONCURRENTLY outside a transaction', async () => {
    const db = await fixture();
    const result = await migrate({
      connectionString: db.url,
      sources: db.sources({
        a: {
          files: {
            '0001_table.sql': 'CREATE TABLE a_t (c int);',
            '0002_index.sql':
              '-- gx:no-transaction\nCREATE INDEX CONCURRENTLY IF NOT EXISTS a_t_c_idx ON a_t (c);',
          },
        },
      }),
    });
    expect(result.ok).toBe(true);
    expect(await db.query("SELECT 1 FROM pg_indexes WHERE indexname = 'a_t_c_idx'")).toHaveLength(
      1,
    );
  });
});

describe('gx-migrate command', () => {
  const cli = fileURLToPath(new URL('./bin/gx-migrate.ts', import.meta.url));
  const run = (args: string[], env: Record<string, string>) =>
    spawnSync(process.execPath, ['--conditions=@gx/source', cli, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });

  function workspace(db: Fixture, sql: string): string {
    const root = join(db.root, 'ws');
    mkdirSync(join(root, 'packages/a/migrations'), { recursive: true });
    writeFileSync(
      join(root, 'packages/register.json'),
      JSON.stringify({ packages: [{ id: 'a', path: 'packages/a', depends: [] }] }),
    );
    writeFileSync(join(root, 'packages/a/migrations/0001_a.sql'), sql);
    return root;
  }

  it('applies with up, never prints the connection string, and is quiet on a second plan', async () => {
    const db = await fixture();
    const root = workspace(db, 'CREATE TABLE a_t (id int);');
    const up = run(['up', '--root', root], { DATABASE_MIGRATION_URL: db.url });
    expect(up.status).toBe(0);
    expect(up.stdout).toContain('applied a/0001_a');
    expect(up.stdout + up.stderr).not.toContain(db.url);
    const plan = run(['plan', '--root', root], { DATABASE_MIGRATION_URL: db.url });
    expect(plan.stdout).toContain('plan: 0 pending, 1 already applied');
  });

  it('exits 1 on check with a destructive step and 2 without a database URL', async () => {
    const db = await fixture();
    const root = workspace(db, 'DROP TABLE a_t;');
    expect(run(['check', '--root', root], {}).status).toBe(1);
    expect(run(['up', '--root', root], { DATABASE_MIGRATION_URL: '' }).status).toBe(2);
  });
});

describe('review fixes', () => {
  it('does not re-judge applied migrations: a file that breaks a newer rule is grandfathered', async () => {
    const db = await fixture();
    const sources = db.sources({ a: { files: { '0001_old.sql': 'CREATE TABLE a_t (id int);' } } });
    await migrate({ connectionString: db.url, sources });
    // Pretend 0002 was applied under older rules: same checksum, but UPDATE is now contract-only.
    const sql = 'UPDATE a_t SET id = 1;';
    writeFileSync(join(db.root, 'packages/a/migrations/0002_backfill.sql'), sql);
    const { createHash } = await import('node:crypto');
    await db.query(
      `INSERT INTO ${LEDGER_TABLE} (package_id, name, checksum, phase, status, applied_at) VALUES ('a', '0002_backfill', '${createHash('sha256').update(sql).digest('hex')}', 'expand', 'applied', now())`,
    );
    const result = await migrate({ connectionString: db.url, sources });
    expect(result.ok && result.value.alreadyApplied).toBe(2);
  });

  it('fails fast on a busy table instead of queueing app traffic behind DDL', async () => {
    const db = await fixture();
    const sources = db.sources({ a: { files: { '0001_t.sql': 'CREATE TABLE a_t (id int);' } } });
    await migrate({ connectionString: db.url, sources });
    writeFileSync(
      join(db.root, 'packages/a/migrations/0002_col.sql'),
      'ALTER TABLE a_t ADD COLUMN c int;',
    );
    const holder = new pg.Client({ connectionString: db.url });
    await holder.connect();
    try {
      await holder.query('BEGIN');
      await holder.query('LOCK TABLE a_t IN ACCESS SHARE MODE');
      const result = await migrate({
        connectionString: db.url,
        sources,
        migrationLockTimeoutMs: 300,
      });
      expect(!result.ok && result.error).toMatchObject({
        kind: 'migration-failed',
        sqlState: '55P03',
      });
      expect(
        !result.ok && result.error.kind === 'migration-failed' && result.error.message,
      ).toContain('busy');
    } finally {
      await holder.end();
    }
  });

  it('resets session settings between migrations', async () => {
    const db = await fixture();
    const result = await migrate({
      connectionString: db.url,
      sources: db.sources({
        a: {
          files: {
            '0001_schema.sql': 'CREATE SCHEMA a_side;',
            '0002_path.sql':
              "-- gx:phase contract\n-- gx:reason test of session reset\nSELECT set_config('search_path', 'a_side', false);",
            '0003_table.sql': 'CREATE TABLE a_t (id int);',
          },
        },
      }),
    });
    expect(result.ok).toBe(true);
    const where = await db.query<{ table_schema: string }>(
      "SELECT table_schema FROM information_schema.tables WHERE table_name = 'a_t'",
    );
    expect(where.map((r) => r.table_schema)).toEqual(['public']);
  });

  it('stops as dirty after a no-transaction migration fails, until an operator clears it', async () => {
    const db = await fixture();
    const sources = db.sources({
      a: {
        files: {
          '0001_index.sql':
            '-- gx:no-transaction\nCREATE INDEX CONCURRENTLY IF NOT EXISTS a_idx ON a_missing (c);',
        },
      },
    });
    const first = await migrate({ connectionString: db.url, sources });
    expect(!first.ok && first.error.kind).toBe('migration-failed');
    const second = await migrate({ connectionString: db.url, sources });
    expect(!second.ok && second.error).toMatchObject({
      kind: 'dirty',
      migrations: ['a/0001_index'],
    });
    expect(await forgetStarted(db.url, 'a/0001_index')).toEqual({ ok: true, value: undefined });
    expect((await forgetStarted(db.url, 'a/0001_index')).ok).toBe(false);
  });

  it('records the release and who applied each migration', async () => {
    const db = await fixture();
    await migrate({
      connectionString: db.url,
      sources: db.sources(TWO_PACKAGES),
      release: 'abc1234',
    });
    const rows = await db.query<{ release: string; applied_by: string; status: string }>(
      `SELECT release, applied_by, status FROM ${LEDGER_TABLE}`,
    );
    expect(
      rows.every(
        (r) => r.release === 'abc1234' && r.applied_by === 'gx_test' && r.status === 'applied',
      ),
    ).toBe(true);
  });

  it('plan creates nothing, not even the ledger schema', async () => {
    const db = await fixture();
    await migrate({ connectionString: db.url, sources: db.sources(TWO_PACKAGES), dryRun: true });
    expect(
      await db.query(
        "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'gx_migrations'",
      ),
    ).toEqual([]);
  });

  it('refuses a ledger written by a newer runner', async () => {
    const db = await fixture();
    const sources = db.sources(TWO_PACKAGES);
    await migrate({ connectionString: db.url, sources });
    await db.query("UPDATE gx_migrations.meta SET value = '99' WHERE key = 'ledger_version'");
    const result = await migrate({ connectionString: db.url, sources });
    expect(!result.ok && result.error.kind).toBe('ledger-too-new');
  });

  it('blocks a security-sensitive statement unless it is reviewed', async () => {
    const db = await fixture();
    const unreviewed = db.sources({
      a: {
        files: {
          '0001_t.sql': 'CREATE TABLE a_t (id int);\nALTER TABLE a_t DISABLE ROW LEVEL SECURITY;',
        },
      },
    });
    const blocked = await migrate({ connectionString: db.url, sources: unreviewed });
    expect(!blocked.ok && blocked.error.kind === 'invalid' && blocked.error.problems[0]?.rule).toBe(
      'security-review-required',
    );
    writeFileSync(
      join(db.root, 'packages/a/migrations/0001_t.sql'),
      '-- gx:security-reviewed test fixture, reviewed by the suite\nCREATE TABLE a_t (id int);\nALTER TABLE a_t DISABLE ROW LEVEL SECURITY;',
    );
    expect((await migrate({ connectionString: db.url, sources: unreviewed })).ok).toBe(true);
  });
});
