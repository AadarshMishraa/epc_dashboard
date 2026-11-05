import { describe, expect, it } from 'vitest';
import { isEraserHandlerId } from './erasure.ts';
import { toFrozenJson } from './json.ts';
import { maskRecipient, prepareMessage, type OutboundMessage } from './messages.ts';
import { isIdempotencyKey } from './quotas.ts';

function nested(levels: number): unknown {
  let value: unknown = 1;
  for (let i = 0; i < levels; i += 1) value = [value];
  return value;
}

describe('toFrozenJson depth limit', () => {
  it('accepts 64 levels of nesting', () => {
    expect(toFrozenJson(nested(64)).ok).toBe(true);
  });

  it('rejects 65 levels as too deep', () => {
    const result = toFrozenJson(nested(65));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.fields[0]?.code).toBe('too_deep');
  });

  it('accepts the same object twice when it is not a cycle', () => {
    const shared = { a: 1 };
    const result = toFrozenJson({ left: shared, right: shared });
    expect(result.ok).toBe(true);
  });

  it('copies a large flat payload intact', () => {
    const big = Array.from({ length: 10_000 }, (_, i) => ({ i }));
    const result = toFrozenJson(big);
    expect(result.ok && (result.value as readonly unknown[]).length).toBe(10_000);
  });
});

describe('recipient boundaries', () => {
  const base: OutboundMessage = {
    channel: 'email',
    to: 'a@example.com',
    template: 'welcome',
    purpose: 'onboarding',
    consentRef: 'consent-1',
  };
  const email = (local: number, total: number): string => {
    const domain = 'b'.repeat(total - local - 1 - 4) + '.com';
    return `${'a'.repeat(local)}@${domain}`;
  };
  const accepts = (message: OutboundMessage): boolean => prepareMessage(message).ok;

  it('accepts an email of exactly 254 characters with a 64-character local part', () => {
    const to = email(64, 254);
    expect(to).toHaveLength(254);
    expect(accepts({ ...base, to })).toBe(true);
  });

  it('rejects an email of 255 characters', () => {
    expect(accepts({ ...base, to: email(64, 255) })).toBe(false);
  });

  it('rejects a 65-character local part', () => {
    expect(accepts({ ...base, to: email(65, 120) })).toBe(false);
  });

  it.each([
    ['8 digits', '+19800001', true],
    ['15 digits', '+919800001234567', true],
    ['7 digits', '+1980000', false],
    ['16 digits', '+9198000012345678', false],
    ['a leading zero country code', '+09800001234', false],
  ])('an SMS number of %s is accepted: %s', (_label, to, expected) => {
    expect(accepts({ ...base, channel: 'sms', to })).toBe(expected);
  });

  it('masks a one-character local part without revealing more', () => {
    expect(maskRecipient('email', 'a@example.com')).toBe('a***@e***.com');
  });
});

describe('idempotency key length', () => {
  it('accepts 255 characters and rejects 256', () => {
    expect(isIdempotencyKey('k'.repeat(255))).toBe(true);
    expect(isIdempotencyKey('k'.repeat(256))).toBe(false);
  });
});

describe('eraser handler id length', () => {
  it('accepts 128 characters and rejects 129', () => {
    expect(isEraserHandlerId('a'.repeat(128))).toBe(true);
    expect(isEraserHandlerId('a'.repeat(129))).toBe(false);
  });
});
