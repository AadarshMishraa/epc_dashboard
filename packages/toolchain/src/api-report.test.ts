import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  type ApiExtraction,
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
    exactOptionalPropertyTypes: true,
    noEmit: true,
    skipLibCheck: true,
    allowImportingTsExtensions: true,
    types: [],
  },
  include: ['src'],
};

function write(root: string, files: Record<string, string | object>): void {
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(
      join(root, path),
      typeof contents === 'string' ? contents : `${JSON.stringify(contents, null, 2)}\n`,
    );
  }
}

/** A one-package workspace; `source` is src/index.ts, `extra` more files under src/. */
function workspace(source: string, version = '1.0.0', extra: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'gx-api-'));
  roots.push(root);
  write(root, {
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
    ...Object.fromEntries(Object.entries(extra).map(([p, c]) => [`packages/core/src/${p}`, c])),
  });
  return root;
}

const extract = (root: string): ApiExtraction =>
  extractApi({
    tsconfigPath: join(root, 'packages/core/tsconfig.json'),
    entry: join(root, 'packages/core/src/index.ts'),
  });

/** The change from `before` to `after` as seen by the gate. */
const diff = (
  before: string,
  after: string,
  extraBefore: Record<string, string> = {},
  extraAfter = extraBefore,
) =>
  diffApi(
    extract(workspace(before, '1.0.0', extraBefore)).exports,
    extract(workspace(after, '1.0.0', extraAfter)).exports,
  );

describe('extractApi', () => {
  it('records meanings and normalised declaration text, without comments', () => {
    const { exports, problems } = extract(
      workspace(
        '/** docs */\nexport const LIMIT = 64;\nexport function greet(name: string): string { return name; }\n',
      ),
    );
    expect(problems).toEqual([]);
    // Binary order, not locale order, so reports are identical on every machine.
    expect(exports).toEqual([
      { name: 'LIMIT', meanings: ['value'], declarations: ['declare const LIMIT = 64;'] },
      {
        name: 'greet',
        meanings: ['value'],
        declarations: ['declare function greet(name: string): string;'],
      },
    ]);
  });

  it('writes no absolute paths, so reports match on every machine', () => {
    const root = workspace("export * as ns from './ns.ts';\n", '1.0.0', {
      'ns.ts': 'export const a = 1;\nexport type B = { b: string };\n',
    });
    expect(JSON.stringify(extract(root))).not.toContain(root);
  });
});

describe('breaking changes the gate must see (review findings)', () => {
  it.each([
    [
      'a constructor parameter added',
      'export class Box { constructor(readonly size: number) {} }',
      'export class Box { constructor(readonly size: number, readonly depth: number) {} }',
    ],
    [
      'a static removed',
      'export class Box { static make(): Box { return new Box(); } }',
      'export class Box {}',
    ],
    [
      'public turned private',
      'export class Box { size = 1; }',
      'export class Box { private size = 1; }',
    ],
    ['abstract added', 'export class Box {}', 'export abstract class Box {}'],
    [
      'an interface call signature changed',
      'export interface Fn { (a: string): void }',
      'export interface Fn { (a: number): void }',
    ],
    [
      'an index signature changed',
      'export interface Bag { [k: string]: number }',
      'export interface Bag { [k: string]: string }',
    ],
    [
      'mutable turned readonly',
      'export interface P { x: number }',
      'export interface P { readonly x: number }',
    ],
    ['an enum member removed', 'export enum Mode { Read, Draft }', 'export enum Mode { Read }'],
    [
      'a namespace export removed',
      'export namespace N { export const a = 1; export const b = 2; }',
      'export namespace N { export const a = 1; }',
    ],
    [
      'the type half of a merged const and type changed',
      "export const Kind = 'a';\nexport type Kind = 'a';",
      "export const Kind = 'a';\nexport type Kind = 'a' | 'b';",
    ],
    [
      'a value export turned type-only',
      "export { x } from './x.ts';",
      "export type { x } from './x.ts';",
    ],
    [
      'an overload removed',
      'export function f(a: string): void;\nexport function f(a: number): void;\nexport function f(a: unknown): void {}',
      'export function f(a: string): void;\nexport function f(a: unknown): void {}',
    ],
    [
      'a generic constraint narrowed',
      'export function f<T>(a: T): T { return a; }',
      'export function f<T extends string>(a: T): T { return a; }',
    ],
    [
      'an optional parameter made required',
      'export function f(a?: string): void {}',
      'export function f(a: string): void {}',
    ],
  ])('%s', (_label, before, after) => {
    const extra = { 'x.ts': 'export const x = 1;\n' };
    const changes = diff(before, after, extra);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.breaking).toBe(true);
  });

  it('sees a change inside a namespace re-export (export * as ns)', () => {
    const changes = diff(
      "export * as ns from './ns.ts';",
      "export * as ns from './ns.ts';",
      { 'ns.ts': 'export const a = 1;\n' },
      { 'ns.ts': 'export const a = 1;\nexport const b = 2;\n' },
    );
    expect(changes.map((c) => c.breaking)).toEqual([true]);
  });
});

describe('fail-closed extraction rules', () => {
  it('reports a forgotten export: an unexported package type used by an export', () => {
    const { problems } = extract(
      workspace(
        "import type { Hidden } from './hidden.ts';\nexport function use(h: Hidden): void {}\n",
        '1.0.0',
        {
          'hidden.ts': 'export interface Hidden { readonly a: number }\n',
        },
      ),
    );
    expect(problems).toEqual([
      'use uses Hidden, which is declared in this package but not exported; export it so its changes are tracked',
    ]);
  });

  it('accepts the same type once it is exported', () => {
    const { problems } = extract(
      workspace(
        "import type { Hidden } from './hidden.ts';\nexport type { Hidden };\nexport function use(h: Hidden): void {}\n",
        '1.0.0',
        {
          'hidden.ts': 'export interface Hidden { readonly a: number }\n',
        },
      ),
    );
    expect(problems).toEqual([]);
  });

  it('reports `any` in the public API', () => {
    expect(extract(workspace('export function f(a: any): void {}\n')).problems[0]).toContain(
      'exposes `any`',
    );
  });

  it('ignores private class members and type parameters', () => {
    const { problems } = extract(
      workspace(
        "import type { Hidden } from './hidden.ts';\nexport class Box<T> { private h?: Hidden; value?: T; }\n",
        '1.0.0',
        {
          'hidden.ts': 'export interface Hidden { readonly a: number }\n',
        },
      ),
    );
    expect(problems).toEqual([]);
  });
});

describe('diffApi', () => {
  it('finds nothing when only comments changed', () => {
    expect(diff('/** a */\nexport const A = 1;', '/** b */\nexport const A = 1;')).toEqual([]);
  });

  it('marks a removed export as breaking and a new one as additive', () => {
    expect(
      diff('export const A = 1;\nexport const B = 2;', 'export const A = 1;\nexport const C = 3;'),
    ).toEqual([
      { name: 'B', kind: 'removed', breaking: true, detail: 'B was removed' },
      { name: 'C', kind: 'added', breaking: false, detail: 'C was added' },
    ]);
  });

  it('treats new optional interface members as widening, and anything else as breaking', () => {
    const base = 'export interface O { readonly name: string }';
    expect(
      diff(base, 'export interface O { readonly name: string; readonly loud?: boolean }')[0],
    ).toMatchObject({ kind: 'widened', breaking: false });
    expect(
      diff(base, 'export interface O { readonly name: string; readonly loud: boolean }')[0],
    ).toMatchObject({ kind: 'changed', breaking: true });
    expect(
      diff(base, 'export interface O<T> { readonly name: string; readonly v?: T }')[0],
    ).toMatchObject({ breaking: true });
  });
});

describe('versions', () => {
  const v = (text: string) => parseVersion(text) ?? { major: -1, minor: -1, patch: -1 };
  const breaking = [{ name: 'x', kind: 'removed', breaking: true, detail: '' }] as const;
  const additive = [{ name: 'x', kind: 'added', breaking: false, detail: '' }] as const;

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

  it('from 1.0.0: a break needs major, an addition minor', () => {
    expect(requiredBump(breaking, v('1.0.0'))).toBe('major');
    expect(requiredBump(additive, v('1.0.0'))).toBe('minor');
    expect(requiredBump([], v('1.0.0'))).toBe('none');
  });

  it('before 1.0.0: a break needs minor, an addition nothing', () => {
    expect(requiredBump(breaking, v('0.3.0'))).toBe('minor');
    expect(requiredBump(additive, v('0.3.0'))).toBe('none');
  });

  it('compares bumps and rejects malformed versions', () => {
    expect(bumpSatisfies('major', 'minor')).toBe(true);
    expect(bumpSatisfies('patch', 'minor')).toBe(false);
    expect(parseVersion('1.0')).toBeUndefined();
    expect(parseVersion('v1.0.0')).toBeUndefined();
  });
});

const SOURCE =
  'export const LIMIT = 64;\nexport function greet(name: string): string { return name; }\n';

describe('checkApi', () => {
  function released(version = '1.0.0'): { root: string; base: string } {
    const root = workspace(SOURCE, version);
    checkApi({ root, update: true });
    return { root, base: readFileSync(join(root, 'packages/core/public-api.json'), 'utf8') };
  }

  function change(root: string, source: string, version: string): void {
    write(root, {
      'packages/core/src/index.ts': source,
      'packages/core/package.json': { name: '@gx/core', version, type: 'module' },
    });
    checkApi({ root, update: true });
  }

  it('passes when the report matches the source', () => {
    expect(checkApi({ root: released().root }).problems).toEqual([]);
  });

  it('fails when the API changed but the report did not', () => {
    const { root } = released();
    write(root, { 'packages/core/src/index.ts': `${SOURCE}export const EXTRA = 1;\n` });
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

  it('fails a removed export without a major bump (F-04-AC4)', () => {
    const { root, base } = released();
    change(root, SOURCE.replace('export const LIMIT = 64;\n', ''), '1.1.0');
    const [problem] = checkApi({ root, readBase: () => base }).problems;
    expect(problem?.message).toContain(
      '1.0.0 -> 1.1.0 is a minor bump, but the API change needs at least major',
    );
    expect(problem?.message).toContain('LIMIT was removed');
  });

  it('passes the same removal with a major bump', () => {
    const { root, base } = released();
    change(root, SOURCE.replace('export const LIMIT = 64;\n', ''), '2.0.0');
    expect(checkApi({ root, readBase: () => base }).problems).toEqual([]);
  });

  it('before 1.0.0, needs a minor bump for a break and nothing for an addition', () => {
    const { root, base } = released('0.1.0');
    change(root, `${SOURCE}export const EXTRA = 1;\n`, '0.1.0');
    expect(checkApi({ root, readBase: () => base }).problems).toEqual([]);
    change(root, 'export const LIMIT = 64;\n', '0.1.1');
    expect(checkApi({ root, readBase: () => base }).problems[0]?.message).toContain(
      'needs at least minor',
    );
  });

  it('fails a version that goes back', () => {
    const { root, base } = released();
    change(root, SOURCE, '0.9.0');
    expect(checkApi({ root, readBase: () => base }).problems[0]?.message).toContain(
      'version went back',
    );
  });

  it('lists a package that is new on the base branch instead of skipping it silently', () => {
    const result = checkApi({ root: released().root, readBase: () => undefined });
    expect(result.problems).toEqual([]);
    expect(result.newPackages).toEqual(['@gx/core']);
  });

  it('refuses a base report in another format unless the change is allowed', () => {
    const { root, base } = released();
    const old = JSON.stringify({ ...(JSON.parse(base) as object), format: 1 });
    expect(checkApi({ root, readBase: () => old }).problems[0]?.message).toContain(
      '--allow-format-change',
    );
    expect(checkApi({ root, readBase: () => old, allowFormatChange: true }).problems).toEqual([]);
  });

  it('reports forgotten exports as problems', () => {
    const root = workspace(
      "import type { H } from './h.ts';\nexport function f(h: H): void {}\n",
      '1.0.0',
      { 'h.ts': 'export interface H { a: number }\n' },
    );
    expect(checkApi({ root, update: true }).problems[0]?.message).toContain('not exported');
  });
});

// Each case spawns Node and compiles TypeScript several times; allow for a busy CI runner.
describe(
  'gx-check-api command against a git base (F-04-AC4 end to end)',
  { timeout: 60_000 },
  () => {
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
      git(root, 'checkout', '-q', '-b', 'feature');
      return root;
    }

    it('exits 1 for a removed export with only a minor bump, and 0 with a major bump', () => {
      const root = repo();
      write(root, {
        'packages/core/src/index.ts': 'export const LIMIT = 64;\n',
        'packages/core/package.json': { name: '@gx/core', version: '1.1.0', type: 'module' },
      });
      expect(run(root, ['--update']).status).toBe(0);
      git(root, 'commit', '-qam', 'remove greet');
      const minor = run(root, ['--base', 'main']);
      expect(minor.status).toBe(1);
      expect(minor.stdout).toContain('BREAKING greet was removed');
      write(root, {
        'packages/core/package.json': { name: '@gx/core', version: '2.0.0', type: 'module' },
      });
      run(root, ['--update']);
      expect(run(root, ['--base', 'main']).status).toBe(0);
    });

    it('compares with the merge-base, so additions on main do not count as removals here', () => {
      const root = repo();
      git(root, 'checkout', '-q', 'main');
      write(root, {
        'packages/core/src/index.ts': `${SOURCE}export const ON_MAIN = 1;\n`,
        'packages/core/package.json': { name: '@gx/core', version: '1.1.0', type: 'module' },
      });
      run(root, ['--update']);
      git(root, 'commit', '-qam', 'main adds ON_MAIN');
      git(root, 'checkout', '-q', 'feature');
      expect(run(root, ['--base', 'main']).status).toBe(0);
    });

    it('lists a package added on the branch as new since the base', () => {
      const root = repo();
      const register = JSON.parse(readFileSync(join(root, 'packages/register.json'), 'utf8')) as {
        packages: object[];
      };
      register.packages.push({
        id: 'extra',
        package: '@gx/extra',
        path: 'packages/extra',
        kind: 'support',
        plan: 'K0',
        purpose: 'x',
        depends: [],
      });
      write(root, {
        'packages/register.json': register,
        'packages/extra/package.json': { name: '@gx/extra', version: '0.0.0', type: 'module' },
        'packages/extra/tsconfig.json': TSCONFIG,
        'packages/extra/src/index.ts': 'export const E = 1;\n',
      });
      expect(run(root, ['--update']).status).toBe(0);
      git(root, 'add', '-A');
      git(root, 'commit', '-qm', 'add extra');
      const result = run(root, ['--base', 'main']);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('@gx/extra: new since the base, not compared');
    });

    it('exits 2 for a base ref that does not exist', () => {
      expect(run(repo(), ['--base', 'no-such-branch']).status).toBe(2);
    });
  },
);

describe('this repository', () => {
  it('has a current public-api.json for every package, with no forgotten exports or any', () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const result = checkApi({ root });
    expect(result.problems).toEqual([]);
    expect(result.packagesChecked).toBe(13);
  }, 60_000);
});
