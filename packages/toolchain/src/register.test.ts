import { describe, expect, it } from 'vitest';
import { parseRegister } from './register.ts';

function entry(id: string, depends: string[] = [], extra: Record<string, unknown> = {}) {
  return {
    id,
    package: `@gx/${id}`,
    path: `packages/${id}`,
    kind: 'module',
    plan: 'K0',
    purpose: `Test package ${id}.`,
    depends,
    ...extra,
  };
}

function problemsOf(input: unknown): readonly string[] {
  const parsed = parseRegister(input);
  return parsed.ok ? [] : parsed.problems;
}

describe('parseRegister', () => {
  it('accepts a consistent register', () => {
    const parsed = parseRegister({
      packages: [
        entry('core'),
        entry('k1-tenancy', ['core'], { devDepends: ['testkit'] }),
        entry('testkit', ['core']),
      ],
    });
    expect(parsed.ok).toBe(true);
  });

  it('rejects an unknown key and names it', () => {
    const problems = problemsOf({ packages: [entry('core', [], { owner: 'someone' })] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('owner');
  });

  it('rejects an empty package list', () => {
    expect(problemsOf({ packages: [] })).toHaveLength(1);
  });

  it('rejects an id that breaks the naming rule', () => {
    expect(problemsOf({ packages: [entry('K1_Tenancy')] }).join()).toContain('lowercase words');
  });

  it('rejects a package name or path that does not follow the id', () => {
    const problems = problemsOf({
      packages: [entry('core', [], { package: '@gx/kernel', path: 'lib/core' })],
    });
    expect(problems).toEqual([
      'core: package must be @gx/core, found @gx/kernel',
      'core: path must be packages/core, found lib/core',
    ]);
  });

  it('rejects duplicate ids', () => {
    expect(problemsOf({ packages: [entry('core'), entry('core')] })).toContain('duplicate id core');
  });

  it('rejects unknown and self dependencies', () => {
    const problems = problemsOf({
      packages: [entry('core', ['core']), entry('k1-tenancy', ['k9-missing'])],
    });
    expect(problems).toContain('core: depends on itself');
    expect(problems).toContain('k1-tenancy: depends on unknown id k9-missing');
  });

  it('rejects a dependency cycle and prints its path', () => {
    const problems = problemsOf({
      packages: [
        entry('core', ['k2-identity']),
        entry('k1-tenancy', ['core']),
        entry('k2-identity', ['k1-tenancy']),
      ],
    });
    expect(problems).toEqual(['dependency cycle: core -> k2-identity -> k1-tenancy -> core']);
  });

  it('rejects a support package (test fakes, tooling) as a runtime dependency of a module', () => {
    const problems = problemsOf({
      packages: [
        entry('core'),
        entry('testkit', ['core'], { kind: 'support' }),
        entry('k1-tenancy', ['core', 'testkit']),
      ],
    });
    expect(problems).toEqual([
      'k1-tenancy: module may not depend on support package testkit at runtime; list it in devDepends',
    ]);
  });

  it('rejects testkit as a runtime dependency of any package, support packages included', () => {
    const problems = problemsOf({
      packages: [
        entry('core'),
        entry('testkit', ['core'], { kind: 'support' }),
        entry('migrate', ['core', 'testkit'], { kind: 'support' }),
      ],
    });
    expect(problems).toEqual([
      'migrate: testkit is test-only; list it in devDepends, never depends',
    ]);
  });

  it('allows a support package in a module’s devDepends and in another support package', () => {
    const parsed = parseRegister({
      packages: [
        entry('core'),
        entry('testkit', ['core'], { kind: 'support' }),
        entry('toolchain', ['core'], { kind: 'support', devDepends: ['testkit'] }),
        entry('migrate', ['core', 'toolchain'], { kind: 'support' }),
        entry('k1-tenancy', ['core'], { devDepends: ['testkit'] }),
      ],
    });
    expect(parsed.ok).toBe(true);
  });

  it('treats a test-only dependency as part of the cycle check', () => {
    const problems = problemsOf({
      packages: [entry('core', [], { devDepends: ['testkit'] }), entry('testkit', ['core'])],
    });
    expect(problems).toEqual(['dependency cycle: core -> testkit -> core']);
  });
});
