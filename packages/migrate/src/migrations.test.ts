import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadMigrations, type MigrationSource } from './migrations.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** Package id to { file name: SQL }, with dependencies. */
function sources(
  packages: Record<string, { files?: Record<string, string>; depends?: string[] }>,
): MigrationSource[] {
  const root = mkdtempSync(join(tmpdir(), 'gx-migrations-'));
  roots.push(root);
  return Object.entries(packages).map(([packageId, { files, depends = [] }]) => {
    const dir = join(root, packageId, 'migrations');
    if (files !== undefined) {
      mkdirSync(dir, { recursive: true });
      for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
    }
    return { packageId, dir, depends, displayDir: `packages/${packageId}/migrations` };
  });
}

const rules = (list: MigrationSource[]): string[] =>
  loadMigrations(list).problems.map((p) => p.rule);

describe('loadMigrations order', () => {
  it('runs packages in dependency order, then by number', () => {
    const { migrations, problems } = loadMigrations(
      sources({
        'k6-events': {
          depends: ['k1-tenancy'],
          files: { '0001_create_outbox.sql': 'CREATE TABLE k6_outbox (id int);' },
        },
        'k1-tenancy': {
          files: {
            '0002_add_region.sql': 'ALTER TABLE k1_tenant ADD COLUMN region text;',
            '0001_create_tenant.sql': 'CREATE TABLE k1_tenant (id int);',
          },
        },
        core: {},
      }),
    );
    expect(problems).toEqual([]);
    expect(migrations.map((m) => `${m.packageId}/${m.name}`)).toEqual([
      'k1-tenancy/0001_create_tenant',
      'k1-tenancy/0002_add_region',
      'k6-events/0001_create_outbox',
    ]);
  });

  it('gives each file a stable SHA-256 checksum', () => {
    const list = sources({ a: { files: { '0001_x.sql': 'CREATE TABLE a_x (id int);' } } });
    const [first] = loadMigrations(list).migrations;
    expect(first?.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(loadMigrations(list).migrations[0]?.checksum).toBe(first?.checksum);
  });

  it('reports a dependency cycle and an unknown dependency', () => {
    const problems = loadMigrations(
      sources({ a: { depends: ['b'] }, b: { depends: ['a'] }, c: { depends: ['zz'] } }),
    ).problems.map((p) => p.message);
    expect(problems).toContain('dependency cycle between a, b');
    expect(problems).toContain('c depends on zz, which has no migration source');
  });
});

describe('loadMigrations file rules', () => {
  it.each(['1_short.sql', '0001-dash.sql', '0001_Upper.sql', '0001_x.SQL', 'notes.txt'])(
    'rejects the file name %s',
    (name) => {
      expect(rules(sources({ a: { files: { [name]: 'CREATE TABLE a_x (id int);' } } }))).toEqual([
        'file-name',
      ]);
    },
  );

  it('rejects a gap and a duplicate number', () => {
    expect(
      rules(
        sources({
          a: {
            files: {
              '0001_a.sql': 'CREATE TABLE a_x (id int);',
              '0003_c.sql': 'CREATE TABLE a_x (id int);',
            },
          },
        }),
      ),
    ).toEqual(['numbering']);
    expect(
      rules(
        sources({
          a: {
            files: {
              '0001_a.sql': 'CREATE TABLE a_x (id int);',
              '0001_b.sql': 'CREATE TABLE a_x (id int);',
            },
          },
        }),
      ),
    ).toEqual(['numbering']);
  });

  it('rejects an empty migration', () => {
    expect(rules(sources({ a: { files: { '0001_a.sql': '-- nothing yet\n' } } }))).toEqual([
      'empty',
    ]);
  });
});

describe('expand then contract', () => {
  it('rejects a destructive step without a contract marker, with file and line', () => {
    const { problems } = loadMigrations(
      sources({
        'k1-tenancy': {
          files: { '0001_a.sql': 'CREATE TABLE k1_u (a int);\nALTER TABLE k1_t DROP COLUMN a;\n' },
        },
      }),
    );
    expect(problems).toEqual([
      expect.objectContaining({
        rule: 'destructive-without-contract',
        file: 'packages/k1-tenancy/migrations/0001_a.sql',
        line: 2,
      }),
    ]);
  });

  it('allows a destructive step in a contract migration with a reason', () => {
    const sql =
      '-- gx:phase contract\n-- gx:reason drops legacy_name; unused since release 1.4\nALTER TABLE k1_t DROP COLUMN legacy_name;\n';
    const { migrations, problems } = loadMigrations(
      sources({ a: { files: { '0001_a.sql': sql } } }),
    );
    expect(problems).toEqual([]);
    expect(migrations[0]).toMatchObject({
      phase: 'contract',
      reason: 'drops legacy_name; unused since release 1.4',
    });
  });

  it('requires a reason on a contract migration', () => {
    const sql = '-- gx:phase contract\nALTER TABLE k1_t DROP COLUMN c;\n';
    expect(rules(sources({ a: { files: { '0001_a.sql': sql } } }))).toEqual(['directive']);
  });

  it('never allows transaction control, even in a contract migration', () => {
    const sql = '-- gx:phase contract\n-- gx:reason test\nBEGIN;\nDROP TABLE k1_t;\nCOMMIT;\n';
    expect(rules(sources({ a: { files: { '0001_a.sql': sql } } }))).toEqual([
      'transaction-control',
      'transaction-control',
    ]);
  });

  it.each(['-- gx:phase shrink', '-- gx:unknown', '-- gx:reason', '-- gx:no-transaction yes'])(
    'rejects the malformed directive %s',
    (directive) => {
      expect(
        rules(
          sources({ a: { files: { '0001_a.sql': `${directive}\nCREATE TABLE a_x (id int);\n` } } }),
        ),
      ).toContain('directive');
    },
  );
});

describe('security review', () => {
  const sql = 'CREATE TABLE a_t (id int);\nALTER TABLE a_t DISABLE ROW LEVEL SECURITY;\n';

  it('blocks a security-sensitive statement without a review, even in a contract migration', () => {
    const contract = `-- gx:phase contract\n-- gx:reason test\n${sql}`;
    for (const body of [sql, contract]) {
      const { problems } = loadMigrations(sources({ a: { files: { '0001_a.sql': body } } }));
      expect(problems.map((p) => [p.rule, p.migration])).toEqual([
        ['security-review-required', 'a/0001_a'],
      ]);
    }
  });

  it('accepts it with gx:security-reviewed and records the review', () => {
    const reviewed = `-- gx:security-reviewed needed for the fixture, reviewed by the suite\n${sql}`;
    const { migrations, problems } = loadMigrations(
      sources({ a: { files: { '0001_a.sql': reviewed } } }),
    );
    expect(problems).toEqual([]);
    expect(migrations[0]?.securityReview).toBe('needed for the fixture, reviewed by the suite');
  });
});

describe('gx:no-transaction', () => {
  it('accepts a single statement such as CREATE INDEX CONCURRENTLY', () => {
    const sql =
      '-- gx:no-transaction\nCREATE INDEX CONCURRENTLY IF NOT EXISTS k1_t_c_idx ON k1_t (c);\n';
    const { migrations, problems } = loadMigrations(
      sources({ a: { files: { '0001_a.sql': sql } } }),
    );
    expect(problems).toEqual([]);
    expect(migrations[0]?.transactional).toBe(false);
  });

  it('rejects more than one statement', () => {
    const sql =
      '-- gx:no-transaction\nCREATE INDEX CONCURRENTLY a ON t (c);\nCREATE INDEX CONCURRENTLY b ON t (d);\n';
    expect(rules(sources({ a: { files: { '0001_a.sql': sql } } }))).toEqual([
      'no-transaction-multi-statement',
    ]);
  });
});
