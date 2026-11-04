import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { checkImportGraph, formatViolation, type ImportGraphResult } from './import-graph.ts';

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

function packageJson(id: string, extra: Record<string, unknown> = {}) {
  return {
    name: `@gx/${id}`,
    version: '0.0.0',
    type: 'module',
    exports: PUBLIC_EXPORT,
    ...(id === 'core' ? {} : { dependencies: { '@gx/core': 'workspace:*' } }),
    ...extra,
  };
}

/** Three packages, each depending on core only: the shape of the real skeleton. */
function baseFiles(): Files {
  return {
    'package.json': { name: 'fixture', private: true, devDependencies: { vitest: '5.0.5' } },
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
    'packages/k1-tenancy/src/index.ts':
      "import { moduleId } from '@gx/core';\nexport const MODULE_ID = moduleId('k1-tenancy');\n",
    'packages/k2-identity/package.json': packageJson('k2-identity'),
    'packages/k2-identity/src/index.ts': "export { moduleId } from '@gx/core';\n",
  };
}

const created: string[] = [];

function workspace(overrides: Files = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'gx-import-graph-'));
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

function check(overrides: Files = {}): ImportGraphResult {
  return checkImportGraph({ root: workspace(overrides) });
}

function only(result: ImportGraphResult) {
  expect(result.violations).toHaveLength(1);
  const [violation] = result.violations;
  if (violation === undefined) throw new Error('unreachable: length checked above');
  return violation;
}

afterEach(() => {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------- tests

describe('checkImportGraph on a clean workspace', () => {
  it('reports no violations and counts what it checked', () => {
    const result = check();
    expect(result.violations).toEqual([]);
    expect(result.packagesChecked).toBe(3);
    expect(result.filesChecked).toBe(3);
  });

  it('allows tests to import root development tools and Node builtins', () => {
    const result = check({
      'packages/k1-tenancy/src/index.test.ts':
        "import { readFileSync } from 'node:fs';\nimport { it } from 'vitest';\nimport { MODULE_ID } from './index.ts';\n",
    });
    expect(result.violations).toEqual([]);
  });
});

describe('every package imports only what the register allows', () => {
  it('rejects a module importing a sibling module, with file and line', () => {
    const violation = only(
      check({
        'packages/k2-identity/src/index.ts':
          "export { moduleId } from '@gx/core';\nimport { MODULE_ID } from '@gx/k1-tenancy';\n",
      }),
    );
    expect(violation).toMatchObject({
      rule: 'import-not-allowed',
      file: 'packages/k2-identity/src/index.ts',
      line: 2,
    });
    expect(violation.message).toContain('@gx/k2-identity may not import @gx/k1-tenancy');
    expect(violation.message).toContain('only @gx/core');
  });

  it.each([
    ['import type', "import type { X } from '@gx/k1-tenancy';\n"],
    ['re-export', "export * from '@gx/k1-tenancy';\n"],
    ['dynamic import', "export const load = () => import('@gx/k1-tenancy');\n"],
  ])('sees a sibling import written as %s', (_form, source) => {
    expect(only(check({ 'packages/k2-identity/src/index.ts': source })).rule).toBe(
      'import-not-allowed',
    );
  });

  it('rejects a sibling dependency in package.json that the register does not allow', () => {
    const violation = only(
      check({
        'packages/k2-identity/package.json': packageJson('k2-identity', {
          dependencies: { '@gx/core': 'workspace:*', '@gx/k1-tenancy': 'workspace:*' },
        }),
      }),
    );
    expect(violation.rule).toBe('workspace-dependency');
    expect(violation.message).toContain('the register allows k2-identity only @gx/core');
  });

  it('accepts a sibling dependency once the register allows it', () => {
    const result = check({
      'packages/register.json': {
        packages: [
          registerEntry('core'),
          registerEntry('k1-tenancy', ['core']),
          registerEntry('k2-identity', ['core', 'k1-tenancy']),
        ],
      },
      'packages/k2-identity/package.json': packageJson('k2-identity', {
        dependencies: { '@gx/core': 'workspace:*', '@gx/k1-tenancy': 'workspace:*' },
      }),
      'packages/k2-identity/src/index.ts':
        "export { moduleId } from '@gx/core';\nimport { MODULE_ID } from '@gx/k1-tenancy';\n",
    });
    expect(result.violations).toEqual([]);
  });

  it('rejects a workspace dependency that does not use the workspace protocol', () => {
    const violation = only(
      check({
        'packages/k1-tenancy/package.json': packageJson('k1-tenancy', {
          dependencies: { '@gx/core': '0.0.0' },
        }),
      }),
    );
    expect(violation.rule).toBe('workspace-dependency');
    expect(violation.message).toContain('must be "workspace:*"');
  });

  it('rejects an import of a package that is not registered', () => {
    const violation = only(
      check({ 'packages/k1-tenancy/src/index.ts': "import '@gx/k9-unknown';\n" }),
    );
    expect(violation.rule).toBe('import-not-allowed');
    expect(violation.message).toContain('not a package in packages/register.json');
  });
});

describe('packages talk through public APIs only', () => {
  it('rejects a deep import into another package', () => {
    const violation = only(
      check({
        'packages/k1-tenancy/src/index.ts':
          "import { moduleId } from '@gx/core/src/module-id.ts';\n",
      }),
    );
    expect(violation.rule).toBe('deep-import');
    expect(violation.message).toContain("import '@gx/core'");
  });

  it('rejects a relative import that leaves the package', () => {
    const violation = only(
      check({
        'packages/k1-tenancy/src/index.ts':
          "import { MODULE_ID } from '../../core/src/index.ts';\n",
      }),
    );
    expect(violation).toMatchObject({ rule: 'relative-escape', line: 1 });
  });

  it('allows relative imports inside the package', () => {
    const result = check({
      'packages/k1-tenancy/src/index.ts': "export * from './nested/a.ts';\n",
      'packages/k1-tenancy/src/nested/a.ts': "export { b } from '../b.ts';\n",
      'packages/k1-tenancy/src/b.ts': 'export const b = 1;\n',
    });
    expect(result.violations).toEqual([]);
  });

  it('rejects a package importing itself by name', () => {
    expect(only(check({ 'packages/k1-tenancy/src/a.ts': "import '@gx/k1-tenancy';\n" })).rule).toBe(
      'self-import',
    );
  });
});

describe('each package exposes exactly one public-API file', () => {
  it('rejects a second export entry', () => {
    const violation = only(
      check({
        'packages/k1-tenancy/package.json': packageJson('k1-tenancy', {
          exports: { ...PUBLIC_EXPORT, './internal': './src/internal.ts' },
        }),
      }),
    );
    expect(violation.rule).toBe('public-api');
    expect(violation.message).toContain('exactly one entry');
  });

  it('rejects a missing exports field', () => {
    const pkg: Record<string, unknown> = packageJson('k1-tenancy');
    delete pkg['exports'];
    expect(only(check({ 'packages/k1-tenancy/package.json': pkg })).rule).toBe('public-api');
  });

  it('rejects an export that points somewhere other than src/index.ts', () => {
    const violation = only(
      check({
        'packages/k1-tenancy/package.json': packageJson('k1-tenancy', {
          exports: { '.': { ...PUBLIC_EXPORT['.'], '@gx/source': './src/main.ts' } },
        }),
      }),
    );
    expect(violation.rule).toBe('public-api');
  });

  it('rejects a main field next to exports', () => {
    const violation = only(
      check({
        'packages/k1-tenancy/package.json': packageJson('k1-tenancy', { main: './dist/index.js' }),
      }),
    );
    expect(violation.message).toContain('remove "main"');
  });

  it('rejects a missing public-API file', () => {
    const violation = only(check({ 'packages/k1-tenancy/src/index.ts': null }));
    expect(violation.rule).toBe('public-api');
    expect(violation.message).toContain('does not exist');
  });
});

describe('the register matches the packages on disk', () => {
  it('rejects a package directory with no register entry', () => {
    const violation = only(
      check({ 'packages/k3-entitlements/package.json': packageJson('k3-entitlements') }),
    );
    expect(violation).toMatchObject({
      rule: 'register-mismatch',
      file: 'packages/k3-entitlements/package.json',
    });
  });

  it('rejects a register entry with no package on disk', () => {
    const violation = only(check({ 'packages/k2-identity/package.json': null }));
    expect(violation).toMatchObject({ rule: 'register-mismatch', file: 'packages/register.json' });
  });

  it('rejects a package whose name differs from its register entry', () => {
    const violation = only(
      check({
        'packages/k1-tenancy/package.json': packageJson('k1-tenancy', { name: '@gx/tenancy' }),
      }),
    );
    expect(violation.rule).toBe('register-mismatch');
  });

  it('stops with register-invalid when the register is broken', () => {
    const result = check({ 'packages/register.json': '{ not json' });
    expect(only(result).rule).toBe('register-invalid');
    expect(result.packagesChecked).toBe(0);
  });

  it('stops with register-invalid when the register is missing', () => {
    expect(only(check({ 'packages/register.json': null })).rule).toBe('register-invalid');
  });
});

describe('external imports are declared', () => {
  it('rejects an undeclared third-party import in runtime code', () => {
    const violation = only(check({ 'packages/k1-tenancy/src/a.ts': "import { z } from 'zod';\n" }));
    expect(violation.rule).toBe('undeclared-import');
  });

  it('rejects a development tool imported by runtime code', () => {
    const violation = only(
      check({ 'packages/k1-tenancy/src/a.ts': "import { it } from 'vitest';\n" }),
    );
    expect(violation.message).toContain('development dependency');
  });

  it('accepts a declared third-party import, including a subpath', () => {
    const result = check({
      'packages/k1-tenancy/package.json': packageJson('k1-tenancy', {
        dependencies: { '@gx/core': 'workspace:*', zod: '4.6.7' },
      }),
      'packages/k1-tenancy/src/a.ts': "import { z } from 'zod';\nimport { y } from 'zod/mini';\n",
    });
    expect(result.violations).toEqual([]);
  });

  it('requires the node: prefix for builtins', () => {
    const violation = only(
      check({ 'packages/k1-tenancy/src/a.ts': "import { readFileSync } from 'fs';\n" }),
    );
    expect(violation.message).toContain("'node:fs'");
  });

  it('rejects URL and absolute imports', () => {
    const result = check({
      'packages/k1-tenancy/src/a.ts': "import 'https://example.com/x.js';\nimport '/etc/x.js';\n",
    });
    expect(result.violations.map((v) => v.rule)).toEqual([
      'undeclared-import',
      'undeclared-import',
    ]);
  });
});

describe('the gaps found in review stay closed', () => {
  it.each([
    ['export * as ns', "export * as k1 from '@gx/k1-tenancy';\n"],
    ['export type * as', "export type * as k1 from '@gx/k1-tenancy';\n"],
    ['type-level import()', "export type X = import('@gx/k1-tenancy').X;\n"],
    ['require.resolve', "export const p = require.resolve('@gx/k1-tenancy');\n"],
  ])('sees a sibling reference written as %s', (_form, source) => {
    expect(only(check({ 'packages/k2-identity/src/index.ts': source })).rule).toBe(
      'import-not-allowed',
    );
  });

  it('rejects a triple-slash path reference that leaves the package', () => {
    const violation = only(
      check({
        'packages/k1-tenancy/src/a.ts': '/// <reference path="../../core/src/index.ts" />\n',
      }),
    );
    expect(violation.rule).toBe('relative-escape');
  });

  it('rejects a computed dynamic import, which cannot be checked', () => {
    const violation = only(
      check({
        'packages/k1-tenancy/src/a.ts': "const name = '@gx/k2-identity';\nawait import(name);\n",
      }),
    );
    expect(violation).toMatchObject({ rule: 'undeclared-import', line: 2 });
    expect(violation.message).toContain('is computed, so it cannot be checked');
  });

  it.each([
    ['workspace alias', 'workspace:@gx/k2-identity@*'],
    ['link', 'link:../k2-identity'],
    ['file', 'file:../k2-identity'],
    ['npm alias', 'npm:@gx/k2-identity@0.0.0'],
  ])('rejects a dependency that aliases a workspace package through %s', (_kind, spec) => {
    const result = check({
      'packages/k1-tenancy/package.json': packageJson('k1-tenancy', {
        dependencies: { '@gx/core': 'workspace:*', k2: spec },
      }),
      'packages/k1-tenancy/src/a.ts': "import 'k2';\n",
    });
    expect(only(result)).toMatchObject({
      rule: 'workspace-dependency',
      file: 'packages/k1-tenancy/package.json',
    });
  });

  it('rejects a workspace dependency that installs another package under its name', () => {
    const violation = only(
      check({
        'packages/k1-tenancy/package.json': packageJson('k1-tenancy', {
          dependencies: { '@gx/core': 'workspace:@gx/k2-identity@*' },
        }),
      }),
    );
    expect(violation.message).toContain('must be "workspace:*"');
  });

  it('rejects any runtime dependency of an isolated package', () => {
    const violation = only(
      check({
        'packages/core/package.json': packageJson('core', { dependencies: { zod: '4.6.7' } }),
      }),
    );
    expect(violation).toMatchObject({ rule: 'isolation', file: 'packages/core/package.json' });
  });

  it('rejects Node.js I/O in an isolated package, but allows it in its tests', () => {
    const result = check({
      'packages/core/src/a.ts': "import { readFileSync } from 'node:fs';\n",
      'packages/core/src/a.test.ts': "import { readFileSync } from 'node:fs';\n",
    });
    expect(only(result)).toMatchObject({ rule: 'isolation', file: 'packages/core/src/a.ts' });
  });
});

describe('formatViolation', () => {
  it('prints file, line, rule and message on one line', () => {
    expect(
      formatViolation({ rule: 'deep-import', file: 'packages/a/src/x.ts', line: 3, message: 'no' }),
    ).toBe('packages/a/src/x.ts:3 [deep-import] no');
    expect(formatViolation({ rule: 'register-invalid', message: 'no' })).toBe(
      '(workspace) [register-invalid] no',
    );
  });
});

describe('gx-check-imports command', () => {
  const cli = fileURLToPath(new URL('./bin/check-imports.ts', import.meta.url));
  const run = (root: string) =>
    spawnSync(process.execPath, ['--conditions=@gx/source', cli, '--root', root], {
      encoding: 'utf8',
    });

  it('exits 0 on a clean workspace', () => {
    const result = run(workspace());
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('3 packages, 3 files, 0 violations');
  });

  it('exits 1 and prints the offending import path on a violation', () => {
    const result = run(
      workspace({
        'packages/k2-identity/src/index.ts': "import { MODULE_ID } from '@gx/k1-tenancy';\n",
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('packages/k2-identity/src/index.ts:1 [import-not-allowed]');
  });

  it('exits 2 on an unknown option', () => {
    const result = spawnSync(process.execPath, ['--conditions=@gx/source', cli, '--rot', '.'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('could not run');
  });
});

describe('this repository', () => {
  it('passes the import graph check: every package imports only what the register allows', () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const result = checkImportGraph({ root });
    expect(result.violations.map(formatViolation)).toEqual([]);
    expect(result.packagesChecked).toBe(13);
  });

  it('has the 10 module packages F-01-AC2 counts, plus testkit, toolchain and migrate as support', () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const register = JSON.parse(readFileSync(join(root, 'packages/register.json'), 'utf8')) as {
      packages: { id: string; kind: string }[];
    };
    const modules = register.packages.filter((p) => p.kind === 'module').map((p) => p.id);
    expect(modules).toHaveLength(10);
    expect(
      register.packages
        .filter((p) => p.kind === 'support')
        .map((p) => p.id)
        .sort(),
    ).toEqual(['migrate', 'testkit', 'toolchain']);
  });
});
