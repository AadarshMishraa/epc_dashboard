import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { Secret } from './secret.ts';

const VALUE = 'test-only-value-7f3a';

describe('Secret', () => {
  it('reveals its value only through reveal()', () => {
    expect(new Secret(VALUE).reveal()).toBe(VALUE);
  });

  it.each([
    ['String()', (s: Secret) => String(s)],
    ['a template literal', (s: Secret) => `${s.toString()}|${String(s)}`],
    ['string concatenation', (s: Secret) => 'x' + (s as unknown as string)],
    ['JSON.stringify', (s: Secret) => JSON.stringify(s)],
    ['JSON.stringify inside an object', (s: Secret) => JSON.stringify({ key: s, nested: [s] })],
    ['util.inspect', (s: Secret) => inspect(s)],
    ['util.inspect inside an object', (s: Secret) => inspect({ key: s }, { depth: 5 })],
    ['util.inspect showing hidden fields', (s: Secret) => inspect(s, { showHidden: true })],
    ['an object spread', (s: Secret) => JSON.stringify(Object.assign({}, s))],
    ['Object.entries', (s: Secret) => JSON.stringify(Object.entries(s))],
  ])('prints [secret] and never the value through %s', (_label, print) => {
    const output = print(new Secret(VALUE));
    expect(output).not.toContain(VALUE);
  });

  it('prints exactly [secret] for String, JSON and inspect', () => {
    const secret = new Secret(VALUE);
    expect(String(secret)).toBe('[secret]');
    expect(JSON.stringify(secret)).toBe('"[secret]"');
    expect(inspect(secret)).toBe('[secret]');
  });

  it('cannot be changed', () => {
    const secret = new Secret(VALUE);
    expect(Object.isFrozen(secret)).toBe(true);
    expect(() => {
      (secret as unknown as { reveal: () => string }).reveal = () => 'other';
    }).toThrow(TypeError);
    expect(secret.reveal()).toBe(VALUE);
  });

  it.each([
    ['an empty string', ''],
    ['a number', 42],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(() => new Secret(value as string)).toThrow(TypeError);
  });

  it('does not put the value in its error message', () => {
    expect(() => new Secret('')).toThrow(/non-empty string/);
  });
});
