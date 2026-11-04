import { describe, expect, it } from 'vitest';
import { findImports } from './imports.ts';

describe('findImports', () => {
  it('finds every import form with its line', () => {
    const source = [
      "import { a } from 'static';",
      "import type { B } from 'type-only';",
      "export { c } from 're-export';",
      "export * from 'star';",
      "import side from 'side-effect';",
      "import cjs = require('import-equals');",
      'async function load() {',
      "  return import('dynamic');",
      '}',
      "const r = require('required');",
      "import 'bare-side-effect';",
    ].join('\n');

    expect(findImports(source)).toEqual([
      { specifier: 'static', line: 1 },
      { specifier: 'type-only', line: 2 },
      { specifier: 're-export', line: 3 },
      { specifier: 'star', line: 4 },
      { specifier: 'side-effect', line: 5 },
      { specifier: 'import-equals', line: 6 },
      { specifier: 'dynamic', line: 8 },
      { specifier: 'required', line: 10 },
      { specifier: 'bare-side-effect', line: 11 },
    ]);
  });

  it('finds the forms a preprocessor scan misses', () => {
    const source = [
      '/// <reference path="../types/extra.d.ts" />',
      '/// <reference path="local.d.ts" />',
      '/// <reference types="node" />',
      "export * as ns from 'namespace-re-export';",
      "export type * as T from 'type-namespace-re-export';",
      "type X = import('type-import').X;",
      "const p = require.resolve('require-resolve');",
      "const q = import.meta.resolve('meta-resolve');",
      "declare module 'augmented' {}",
    ].join('\n');

    expect(findImports(source)).toEqual([
      { specifier: '../types/extra.d.ts', line: 1 },
      { specifier: './local.d.ts', line: 2 },
      { specifier: 'node', line: 3 },
      { specifier: 'namespace-re-export', line: 4 },
      { specifier: 'type-namespace-re-export', line: 5 },
      { specifier: 'type-import', line: 6 },
      { specifier: 'require-resolve', line: 7 },
      { specifier: 'meta-resolve', line: 8 },
      { specifier: 'augmented', line: 9 },
    ]);
  });

  it('marks a computed import() or require() argument', () => {
    const source =
      "const name = 'x';\nawait import(name);\nrequire(`${name}`);\nimport(`literal`);\n";
    expect(findImports(source)).toEqual([
      { specifier: 'name', line: 2, computed: true },
      { specifier: '`${name}`', line: 3, computed: true },
      { specifier: 'literal', line: 4 },
    ]);
  });

  it('parses JSX in .tsx files', () => {
    const source = "import { a } from 'a';\nexport const C = () => <div>{a}</div>;\n";
    expect(findImports(source, 'component.tsx')).toEqual([{ specifier: 'a', line: 1 }]);
  });

  it('ignores specifiers inside comments and ordinary strings', () => {
    const source = [
      "// import { x } from 'in-line-comment';",
      "/* import { y } from 'in-block-comment'; */",
      'const text = "import { z } from \'in-string\'";',
      "import { real } from 'real';",
    ].join('\n');

    expect(findImports(source)).toEqual([{ specifier: 'real', line: 4 }]);
  });

  it('returns nothing for a file without imports', () => {
    expect(findImports('export const answer = 42;\n')).toEqual([]);
  });

  it('counts lines in files with Windows line endings', () => {
    expect(findImports("// header\r\n\r\nimport { a } from 'a';\r\n")).toEqual([
      { specifier: 'a', line: 3 },
    ]);
  });
});
