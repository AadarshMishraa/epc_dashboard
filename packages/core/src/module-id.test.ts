import { describe, expect, it } from 'vitest';
import { MODULE_ID_MAX_LENGTH, isModuleId, moduleId } from './module-id.ts';

describe('isModuleId', () => {
  it.each(['core', 'testkit', 'k1-tenancy', 'k7a-audit', 'billing', 'a1-b2-c3'])(
    'accepts %s',
    (value) => {
      expect(isModuleId(value)).toBe(true);
    },
  );

  it.each([
    ['empty', ''],
    ['uppercase', 'Core'],
    ['leading digit', '1core'],
    ['leading hyphen', '-core'],
    ['trailing hyphen', 'core-'],
    ['double hyphen', 'k1--tenancy'],
    ['underscore', 'k1_tenancy'],
    ['dot', 'k1.tenancy'],
    ['scope', '@gx/core'],
    ['space', 'k1 tenancy'],
    ['trailing newline', 'core\n'],
    ['non-ASCII letter', 'cöre'],
  ])('rejects %s', (_label, value) => {
    expect(isModuleId(value)).toBe(false);
  });

  it('accepts the maximum length and rejects one character more', () => {
    const atLimit = 'a'.repeat(MODULE_ID_MAX_LENGTH);
    expect(isModuleId(atLimit)).toBe(true);
    expect(isModuleId(`${atLimit}a`)).toBe(false);
  });

  it.each([undefined, null, 42, {}, ['core']])('rejects the non-string %j', (value) => {
    expect(isModuleId(value)).toBe(false);
  });
});

describe('moduleId', () => {
  it('returns the same string, branded', () => {
    const id: string = moduleId('k1-tenancy');
    expect(id).toBe('k1-tenancy');
  });

  it('throws a TypeError that names the invalid value', () => {
    expect(() => moduleId('K1_Tenancy')).toThrow(TypeError);
    expect(() => moduleId('K1_Tenancy')).toThrow('"K1_Tenancy"');
  });
});
