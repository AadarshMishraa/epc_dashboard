import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { checkBoundaries } from './boundaries.ts';
import { formatViolation, type Violation } from './import-graph.ts';

// ---------------------------------------------------------------- fixture workspace

/** File path to contents; objects are written as JSON, null removes a base file. */
type Files = Record<string, string | object | null>;

const PUBLIC_EXPORT = {
  '.': { '@gx/source': './src/index.ts', types: './dist/index.d.ts', default: './dist/index.js' },
};

function registerEntry(id: string, depends: string[] = [], extra: Record<string, unknown> = {}) {
  return {
    id,
    package: `@gx/${id}`,
    path: `packages/${id}`,
    kind: 'module',
    plan: 'K0',
    purpose: `Fixture package ${id}.`,
    depends,
    ...extra,
  };
}

function packageJson(id: string) {
  return {
    name: `@gx/${id}`,
    version: '0.0.0',
    type: 'module',
    exports: PUBLIC_EXPORT,
    ...(id === 'core' ? {} : { dependencies: { '@gx/core': 'workspace:*' } }),
  };
}

/** Three packages; k1-tenancy owns tables starting with k1_, k2-identity owns none yet. */
function baseFiles(): Files {
  return {
    'package.json': { name: 'fixture', private: true },
    'packages/register.json': {
      packages: [
        registerEntry('core', [], { isolated: true }),
        registerEntry('k1-tenancy', ['core']),
        registerEntry('k2-identity', ['core']),
      ],
    },
    'packages/core/package.json': packageJson('core'),
    'packages/core/src/index.ts': "export const MODULE_ID = 'core';\n",
    'packages/k1-tenancy/package.json': packageJson('k1-tenancy'),
    'packages/k1-tenancy/manifest.json': { id: 'k1-tenancy', table_prefix: 'k1_' },
    'packages/k1-tenancy/src/index.ts': "export { moduleId } from '@gx/core';\n",
    'packages/k1-tenancy/migrations/0001_create_tenant.sql':
      'CREATE TABLE k1_tenant (id uuid PRIMARY KEY);\n',
    'packages/k2-identity/package.json': packageJson('k2-identity'),
    'packages/k2-identity/src/index.ts': "export { moduleId } from '@gx/core';\n",
  };
}

const created: string[] = [];

function workspace(overrides: Files = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'gx-boundaries-'));
  created.push(root);
  for (const [path, contents] of Object.entries({ ...baseFiles(), ...overrides })) {
    if (contents === null) continue;
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      target,
      typeof contents === 'string' ? contents : `${JSON.stringify(contents, null, 2)}\n`,
    );
  }
  return root;
}

function violations(overrides: Files = {}): Violation[] {
  return [...checkBoundaries({ root: workspace(overrides) }).violations];
}

function only(found: readonly Violation[]): Violation {
  expect(found.map(formatViolation)).toHaveLength(1);
  const [violation] = found;
  if (violation === undefined) throw new Error('unreachable: length checked above');
  return violation;
}

afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------- the four rules in the brief

describe('seeded violations, one per rule of the brief', () => {
  it('passes the clean workspace', () => {
    const result = checkBoundaries({ root: workspace() });
    expect(result.violations.map(formatViolation)).toEqual([]);
    expect(result.packagesChecked).toBe(3);
  });

  it('fails an upward import: a package using one the register does not allow', () => {
    const found = only(
      violations({ 'packages/k2-identity/src/index.ts': "import '@gx/k1-tenancy';\n" }),
    );
    expect(found).toMatchObject({
      rule: 'import-not-allowed',
      file: 'packages/k2-identity/src/index.ts',
      line: 1,
    });
  });

  it('fails an import of another package internals', () => {
    const found = only(
      violations({
        'packages/k2-identity/package.json': {
          ...packageJson('k2-identity'),
          dependencies: { '@gx/core': 'workspace:*', '@gx/k1-tenancy': 'workspace:*' },
        },
        'packages/register.json': {
          packages: [
            registerEntry('core', [], { isolated: true }),
            registerEntry('k1-tenancy', ['core']),
            registerEntry('k2-identity', ['core', 'k1-tenancy']),
          ],
        },
        'packages/k2-identity/src/index.ts': "import '@gx/k1-tenancy/src/internal.ts';\n",
      }),
    );
    expect(found).toMatchObject({ rule: 'deep-import', line: 1 });
  });

  it('fails a table outside the module table_prefix', () => {
    const found = only(
      violations({
        'packages/k1-tenancy/migrations/0002_more.sql': '\nCREATE TABLE tenant_notes (id uuid);\n',
      }),
    );
    expect(found).toMatchObject({
      rule: 'table-ownership',
      file: 'packages/k1-tenancy/migrations/0002_more.sql',
      line: 2,
    });
    expect(found.message).toContain('tenant_notes');
    expect(found.message).toContain('k1_');
  });

  it('fails an industry word in source', () => {
    const found = only(
      violations({
        'packages/k1-tenancy/src/index.ts': 'export const inverterCount = 0;\n',
      }),
    );
    expect(found).toMatchObject({ rule: 'industry-word', line: 1 });
    expect(found.message).toContain('inverter');
  });
});

// ---------------------------------------------------------------- table ownership

describe('table-ownership', () => {
  const migration = (sql: string): Files => ({
    'packages/k1-tenancy/migrations/0002_extra.sql': sql,
  });

  it('passes tables that carry the prefix, in every form of CREATE TABLE', () => {
    expect(
      violations(
        migration(`
          CREATE TABLE IF NOT EXISTS public.k1_a (id uuid);
          CREATE TABLE "k1_quoted" (id uuid);
          CREATE TABLE k1_part PARTITION OF k1_tenant FOR VALUES IN (1);
          CREATE TABLE k1_copy AS SELECT * FROM k1_tenant;
        `),
      ),
    ).toEqual([]);
  });

  it('fails a table with the wrong prefix, quoted or not, and a prefix in the wrong case', () => {
    const found = violations(
      migration(`
        CREATE TABLE k2_other (id uuid);
        CREATE TABLE "k2_quoted" (id uuid);
        CREATE TABLE "K1_upper" (id uuid);
        CREATE TABLE public.other_schema (id uuid);
      `),
    );
    expect(found.map((v) => [v.rule, v.line])).toEqual([
      ['table-ownership', 2],
      ['table-ownership', 3],
      ['table-ownership', 4],
      ['table-ownership', 5],
    ]);
  });

  it('fails a rename into a name outside the prefix', () => {
    const found = only(violations(migration('ALTER TABLE k1_tenant RENAME TO tenant;')));
    expect(found.rule).toBe('table-ownership');
  });

  it('fails any table in a package whose manifest declares no prefix', () => {
    const found = only(
      violations({
        'packages/k2-identity/migrations/0001_create_user.sql': 'CREATE TABLE k2_user (id uuid);\n',
      }),
    );
    expect(found.message).toContain('declares no table_prefix');
  });

  it('fails when the manifest is missing, not only when it has no prefix', () => {
    const found = only(violations({ 'packages/k1-tenancy/manifest.json': null }));
    expect(found.message).toContain('declares no table_prefix');
  });

  it('does not count a temporary table, a comment or a string', () => {
    expect(
      violations(
        migration(`
          CREATE TEMP TABLE scratch (id int);
          -- CREATE TABLE commented_out (id int);
          SELECT 'CREATE TABLE quoted_text (id int)';
        `),
      ),
    ).toEqual([]);
  });

  it('reads only .sql files in the migrations folder', () => {
    expect(
      violations(migration('-- fine\n')).concat(
        violations({
          'packages/k1-tenancy/migrations/README.md': 'CREATE TABLE stray (id int);\n',
        }),
      ),
    ).toEqual([]);
  });

  it('does not check a package with no migrations', () => {
    expect(violations({ 'packages/k1-tenancy/migrations/0001_create_tenant.sql': null })).toEqual(
      [],
    );
  });
});

// ---------------------------------------------------------------- industry words

describe('industry-word', () => {
  const source = (text: string): Files => ({ 'packages/k1-tenancy/src/index.ts': text });

  it('finds the word in a comment, an identifier, a string, snake, kebab and camel case', () => {
    const found = violations(
      source(
        [
          '// a solar example',
          'export const solar_panel = 1;',
          "export const label = 'epc-invoicing';",
          'export class EPCInvoice {}',
          'export const gstRate = 18;',
          'export const a = "net metering";',
          'export const b = "net-metering";',
        ].join('\n'),
      ),
    );
    expect(found.map((v) => [v.rule, v.line])).toEqual([
      ['industry-word', 1],
      ['industry-word', 2],
      ['industry-word', 3],
      ['industry-word', 4],
      ['industry-word', 5],
      ['industry-word', 6],
      ['industry-word', 7],
    ]);
  });

  it('is case-insensitive', () => {
    expect(only(violations(source('export const x = "Photovoltaic";\n'))).rule).toBe(
      'industry-word',
    );
  });

  it('does not flag a word that only contains an industry word', () => {
    expect(
      violations(
        source('export const epcot = 1; export const gstreamer = 2; export const insolar = 3;\n'),
      ),
    ).toEqual([]);
  });

  it('checks migrations and manifests, but never tests', () => {
    const found = violations({
      'packages/k1-tenancy/migrations/0002_x.sql': '-- solar\nCREATE TABLE k1_x (id int);\n',
      'packages/k1-tenancy/manifest.json': {
        id: 'k1-tenancy',
        table_prefix: 'k1_',
        note: 'epc',
      },
      'packages/k1-tenancy/src/index.test.ts': 'export const solar = 1;\n',
    });
    expect(found.map((v) => v.file)).toEqual([
      'packages/k1-tenancy/manifest.json',
      'packages/k1-tenancy/migrations/0002_x.sql',
    ]);
  });

  it('does not check the packs, which are where industry words belong', () => {
    expect(
      violations({
        'packs/epc/modules/survey/src/index.ts': 'export const solar = 1;\n',
        'packs/epc/modules/survey/manifest.json': { id: 'epc-survey' },
      }),
    ).toEqual([]);
  });

  describe('the allow marker', () => {
    it('allows a word on the same line when a reason is given', () => {
      expect(
        violations(
          source('export const x = "solar"; // boundary:allow industry-word a real label\n'),
        ),
      ).toEqual([]);
    });

    it('allows the next line, and only the next line', () => {
      const found = violations(
        source(
          [
            '// boundary:allow industry-word example in a doc',
            'export const a = "solar";',
            'export const b = "solar";',
          ].join('\n'),
        ),
      );
      expect(found.map((v) => [v.rule, v.line])).toEqual([['industry-word', 3]]);
    });

    it('works in SQL with a double-dash comment', () => {
      expect(
        violations({
          'packages/k1-tenancy/migrations/0002_x.sql':
            "-- boundary:allow industry-word seeded lookup\nINSERT INTO k1_tenant VALUES ('solar');\n",
        }),
      ).toEqual([]);
    });

    it('does not flag an industry word inside the reason of a marker', () => {
      expect(
        violations(
          source('// boundary:allow industry-word a real solar label\nexport const a = "solar";\n'),
        ),
      ).toEqual([]);
    });

    it('does not let a word in its own reason count as the word it allows', () => {
      const found = only(
        violations(source('// boundary:allow industry-word about solar\nexport const x = 1;\n')),
      );
      expect(found).toMatchObject({ rule: 'allow-marker', line: 1 });
    });

    it('fails a marker with no reason, and the word it was meant to cover', () => {
      const found = violations(
        source('export const x = "solar"; // boundary:allow industry-word\n'),
      );
      expect(found.map((v) => v.rule).sort()).toEqual(['allow-marker', 'industry-word']);
    });

    it('fails a marker that allows nothing', () => {
      const found = only(
        violations(source('// boundary:allow industry-word left over\nexport const x = 1;\n')),
      );
      expect(found).toMatchObject({ rule: 'allow-marker', line: 1 });
      expect(found.message).toContain('allows nothing');
    });

    it('does not cover a word two lines below it', () => {
      const found = violations(
        source('// boundary:allow industry-word too far\n\nexport const x = "solar";\n'),
      );
      expect(found.map((v) => v.rule).sort()).toEqual(['allow-marker', 'industry-word']);
    });

    it('is not honoured inside a manifest, which has no comments', () => {
      const found = violations({
        'packages/k1-tenancy/manifest.json': {
          id: 'k1-tenancy',
          table_prefix: 'k1_',
          note: 'solar // boundary:allow industry-word reason',
        },
      });
      expect(found.map((v) => v.rule)).toEqual(['industry-word']);
    });

    it('is not honoured when the words are in a string, not a comment', () => {
      const found = violations(
        source('export const x = "solar boundary:allow industry-word reason";\n'),
      );
      expect(found.map((v) => v.rule)).toEqual(['industry-word']);
    });
  });
});

// ---------------------------------------------------------------- the command

describe('gx-check-boundaries command', () => {
  const cli = fileURLToPath(new URL('./bin/check-boundaries.ts', import.meta.url));
  const run = (root: string) =>
    spawnSync(process.execPath, ['--conditions=@gx/source', cli, '--root', root], {
      encoding: 'utf8',
    });

  it('exits 0 on a clean workspace', () => {
    const result = run(workspace());
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('3 packages');
    expect(result.stdout).toContain('0 violations');
  });

  it.each([
    ['import-not-allowed', { 'packages/k2-identity/src/index.ts': "import '@gx/k1-tenancy';\n" }],
    [
      'table-ownership',
      { 'packages/k1-tenancy/migrations/0002_x.sql': 'CREATE TABLE stray (id int);\n' },
    ],
    ['industry-word', { 'packages/k1-tenancy/src/index.ts': 'export const discom = 1;\n' }],
  ] as [string, Files][])('exits 1 on a seeded %s violation', (rule, files) => {
    const result = run(workspace(files));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`[${rule}]`);
  });

  it('exits 2 when it cannot run', () => {
    const result = spawnSync(process.execPath, ['--conditions=@gx/source', cli, '--rot', '.'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(2);
  });
});

describe('this repository', () => {
  it('passes the boundary lint', () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    expect(checkBoundaries({ root }).violations.map(formatViolation)).toEqual([]);
  });
});
