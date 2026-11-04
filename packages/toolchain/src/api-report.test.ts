import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { checkApi } from './api-check.ts';
import {
  bumpBetween,
  bumpSatisfies,
  diffApi,
  extractApi,
  parseVersion,
  requiredBump,
  type ApiExport,
} from './api-report.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const TSCONFIG = {
  compilerOptions: {
    target: 'es2024',
    module: 'nodenext',
    moduleResolution: 'nodenext',
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    allowImportingTsExtensions: true,
    types: [],
  },
  include: ['src'],
};

/** A one-package workspace; `source` is the package's src/index.ts. */
function workspace(source: string, version = '1.0.0'): string {
  const root = mkdtempSync(join(tmpdir(), 'gx-api-'));
  roots.push(root);
  const files: Record<string, string | object> = {
    'packages/register.json': {
      packages: [
        {
          id: 'core',
          package: '@gx/core',
          path: 'packages/core',
          kind: 'module',
          plan: 'K0',
          purpose: 'x',
          depends: [],
        },
      ],
    },
    'packages/core/package.json': { name: '@gx/core', version, type: 'module' },
    'packages/core/tsconfig.json': TSCONFIG,
    'packages/core/src/index.ts': source,
  };
  write(root, files);
  return root;
}

function write(root: string, files: Record<string, string | object>): void {
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(
      join(root, path),
      typeof contents === 'string' ? contents : `${JSON.stringify(contents, null, 2)}\n`,
    );
  }
}

const SOURCE = [
  'export const LIMIT = 64;',
  'export function greet(name: string): string { return name; }',
  'export interface Options { readonly name: string; readonly loud?: boolean }',
  "export type Mode = 'read' | 'draft';",
  'export class Box { constructor(readonly size: number) {} }',
].join('\n');

const extract = (root: string): ApiExport[] =>
  extractApi({
    tsconfigPath: join(root, 'packages/core/tsconfig.json'),
    entry: join(root, 'packages/core/src/index.ts'),
  });

describe('extractApi', () => {
  it('lists every export with kind and signature, sorted', () => {
    expect(extract(workspace(SOURCE))).toEqual([
      { name: 'Box', kind: 'class', signature: 'Box', members: ['size: number'] },
      { name: 'greet', kind: 'function', signature: '(name: string) => string' },
      { name: 'LIMIT', kind: 'value', signature: '64' },
      { name: 'Mode', kind: 'type', signature: '"read" | "draft"' },
      {
        name: 'Options',
        kind: 'interface',
        signature: 'Options',
        members: ['loud?: boolean | undefined', 'name: string'],
      },
    ]);
  });

  it('sees re-exports and type-only exports', () => {
    const root = workspace(
      "export { greet } from './greet.ts';\nexport type { Shape } from './greet.ts';\n",
    );
    write(root, {
      'packages/core/src/greet.ts':
        'export function greet(): void {}\nexport interface Shape { readonly a: number }\n',
    });
    expect(extract(root).map((e) => e.name)).toEqual(['greet', 'Shape']);
  });
});

describe('diffApi', () => {
  const base = extract(workspace(SOURCE));
  const after = (source: string): ReturnType<typeof diffApi> =>
    diffApi(base, extract(workspace(source)));

  it('finds nothing when nothing changed', () => {
    expect(after(SOURCE)).toEqual([]);
  });

  it('marks a removed export as breaking', () => {
    expect(after(SOURCE.replace("export type Mode = 'read' | 'draft';", ''))).toEqual([
      { name: 'Mode', kind: 'removed', breaking: true, detail: 'type Mode was removed' },
    ]);
  });

  it('marks a changed signature as breaking', () => {
    const [change] = after(
      SOURCE.replace('greet(name: string)', 'greet(name: string, times: number)'),
    );
    expect(change).toMatchObject({ name: 'greet', kind: 'changed', breaking: true });
  });

  it('marks a new export as additive', () => {
    expect(after(`${SOURCE}\nexport const EXTRA = 1;`)).toEqual([
      { name: 'EXTRA', kind: 'added', breaking: false, detail: 'value EXTRA was added' },
    ]);
  });

  it('treats a new optional interface member as additive and a required one as breaking', () => {
    expect(
      after(
        SOURCE.replace(
          'readonly loud?: boolean',
          'readonly loud?: boolean; readonly tone?: string',
        ),
      )[0],
    ).toMatchObject({
      kind: 'widened',
      breaking: false,
    });
    expect(
      after(
        SOURCE.replace('readonly loud?: boolean', 'readonly loud?: boolean; readonly tone: string'),
      )[0],
    ).toMatchObject({
      kind: 'changed',
      breaking: true,
    });
  });

  it('treats a removed interface member as breaking', () => {
    expect(after(SOURCE.replace('readonly loud?: boolean ', ''))[0]).toMatchObject({
      kind: 'changed',
      breaking: true,
    });
  });
});

describe('versions', () => {
  const v = (text: string) => parseVersion(text) ?? { major: -1, minor: -1, patch: -1 };

  it.each([
    ['1.0.0', '2.0.0', 'major'],
    ['1.2.3', '1.3.0', 'minor'],
    ['1.2.3', '1.2.4', 'patch'],
    ['1.2.3', '1.2.3', 'none'],
    ['1.2.3', '1.2.2', 'downgrade'],
    ['2.0.0', '1.9.9', 'downgrade'],
  ])('%s to %s is %s', (from, to, bump) => {
    expect(bumpBetween(v(from), v(to))).toBe(bump);
  });

  it('needs major for a break and minor for an addition from 1.0.0', () => {
    const breaking = [{ name: 'x', kind: 'removed', breaking: true, detail: '' }] as const;
    const additive = [{ name: 'x', kind: 'added', breaking: false, detail: '' }] as const;
    expect(requiredBump(breaking, v('1.0.0'))).toBe('major');
    expect(requiredBump(additive, v('1.0.0'))).toBe('minor');
    expect(requiredBump([], v('1.0.0'))).toBe('none');
  });

  it('shifts down one place before 1.0.0: a break needs minor, an addition patch', () => {
    const breaking = [{ name: 'x', kind: 'removed', breaking: true, detail: '' }] as const;
    const additive = [{ name: 'x', kind: 'added', breaking: false, detail: '' }] as const;
    expect(requiredBump(breaking, v('0.3.0'))).toBe('minor');
    expect(requiredBump(additive, v('0.3.0'))).toBe('patch');
  });

  it('accepts a larger bump than needed and rejects a smaller one', () => {
    expect(bumpSatisfies('major', 'minor')).toBe(true);
    expect(bumpSatisfies('patch', 'minor')).toBe(false);
    expect(bumpSatisfies('none', 'patch')).toBe(false);
  });

  it('rejects malformed versions', () => {
    expect(parseVersion('1.0')).toBeUndefined();
    expect(parseVersion('v1.0.0')).toBeUndefined();
  });
});

describe('checkApi', () => {
  /** A workspace whose committed report and base report are both the 1.0.0 API. */
  function released(): { root: string; base: string } {
    const root = workspace(SOURCE, '1.0.0');
    checkApi({ root, update: true });
    const base = execFileSync('cat', [join(root, 'packages/core/public-api.json')], {
      encoding: 'utf8',
    });
    return { root, base };
  }

  it('passes when the report matches the source', () => {
    const { root } = released();
    expect(checkApi({ root }).problems).toEqual([]);
  });

  it('fails when the API changed but the report did not', () => {
    const { root } = released();
    write(root, { 'packages/core/src/index.ts': `${SOURCE}\nexport const EXTRA = 1;` });
    expect(checkApi({ root }).problems[0]?.message).toContain(
      'the public API changed but the report did not',
    );
  });

  it('fails when the report version differs from package.json', () => {
    const { root } = released();
    write(root, {
      'packages/core/package.json': { name: '@gx/core', version: '1.0.1', type: 'module' },
    });
    expect(checkApi({ root }).problems[0]?.message).toContain(
      'report version 1.0.0 differs from package.json 1.0.1',
    );
  });

  function change(root: string, source: string, version: string): void {
    write(root, {
      'packages/core/src/index.ts': source,
      'packages/core/package.json': { name: '@gx/core', version, type: 'module' },
    });
    checkApi({ root, update: true });
  }

  it('fails a removed export without a major bump (F-04-AC4)', () => {
    const { root, base } = released();
    change(root, SOURCE.replace('export const LIMIT = 64;', ''), '1.1.0');
    const [problem] = checkApi({ root, readBase: () => base }).problems;
    expect(problem?.message).toContain(
      '1.0.0 -> 1.1.0 is a minor bump, but the API change needs at least major',
    );
    expect(problem?.message).toContain('value LIMIT was removed');
  });

  it('passes the same removal with a major bump', () => {
    const { root, base } = released();
    change(root, SOURCE.replace('export const LIMIT = 64;', ''), '2.0.0');
    expect(checkApi({ root, readBase: () => base }).problems).toEqual([]);
  });

  it('needs a minor bump for an addition, not a patch', () => {
    const { root, base } = released();
    change(root, `${SOURCE}\nexport const EXTRA = 1;`, '1.0.1');
    expect(checkApi({ root, readBase: () => base }).problems[0]?.message).toContain(
      'needs at least minor',
    );
    change(root, `${SOURCE}\nexport const EXTRA = 1;`, '1.1.0');
    expect(checkApi({ root, readBase: () => base }).problems).toEqual([]);
  });

  it('fails a version that goes back', () => {
    const { root, base } = released();
    change(root, SOURCE, '0.9.0');
    expect(checkApi({ root, readBase: () => base }).problems[0]?.message).toContain(
      'version went back',
    );
  });

  it('skips the bump check for a package that is new on the base branch', () => {
    const { root } = released();
    expect(checkApi({ root, readBase: () => undefined }).problems).toEqual([]);
  });

  it('reports what changed since the base', () => {
    const { root, base } = released();
    change(root, SOURCE.replace('export const LIMIT = 64;', ''), '2.0.0');
    expect(checkApi({ root, readBase: () => base }).changes).toEqual([
      {
        package: '@gx/core',
        changes: [
          { name: 'LIMIT', kind: 'removed', breaking: true, detail: 'value LIMIT was removed' },
        ],
      },
    ]);
  });
});

describe('gx-check-api command against a git base (F-04-AC4 end to end)', () => {
  const cli = fileURLToPath(new URL('./bin/check-api.ts', import.meta.url));
  const run = (root: string, args: string[]) =>
    spawnSync(process.execPath, ['--conditions=@gx/source', cli, '--root', root, ...args], {
      encoding: 'utf8',
    });
  const git = (root: string, ...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
      cwd: root,
      stdio: 'ignore',
    });

  function repo(): string {
    const root = workspace(SOURCE, '1.0.0');
    expect(run(root, ['--update']).status).toBe(0);
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'release 1.0.0');
    return root;
  }

  it('exits 1 for a removed export with only a minor bump, and 0 with a major bump', () => {
    const root = repo();
    write(root, {
      'packages/core/src/index.ts': SOURCE.replace(
        'export function greet(name: string): string { return name; }',
        '',
      ),
      'packages/core/package.json': { name: '@gx/core', version: '1.1.0', type: 'module' },
    });
    expect(run(root, ['--update']).status).toBe(0);
    const minor = run(root, ['--base', 'main']);
    expect(minor.status).toBe(1);
    expect(minor.stdout).toContain('BREAKING function greet was removed');
    write(root, {
      'packages/core/package.json': { name: '@gx/core', version: '2.0.0', type: 'module' },
    });
    run(root, ['--update']);
    expect(run(root, ['--base', 'main']).status).toBe(0);
  });

  it('exits 2 for a base ref that does not exist', () => {
    const root = repo();
    expect(run(root, ['--base', 'no-such-branch']).status).toBe(2);
  });
});

describe('this repository', () => {
  it('has a current public-api.json for every package', () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const result = checkApi({ root });
    expect(result.problems).toEqual([]);
    expect(result.packagesChecked).toBe(13);
  });
});
