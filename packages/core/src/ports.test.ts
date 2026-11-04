import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  createContext,
  parseCorrelationId,
  parseTenantId,
  requireTenant,
  type Actor,
  type CorrelationId,
  type TenantContext,
  type TenantId,
} from './context.ts';
import { parseId, type Id } from './ids.ts';
import { ALLOW, actorCeiling, authorize, deny, isAllowed } from './ports/authorizer.ts';
import { atLeast } from './ports/classification.ts';
import { checkEntitlement } from './ports/entitlements.ts';
import { maskAddress, validateOutgoing } from './ports/messages.ts';
import { isValidQuotaAmount } from './ports/quota.ts';
import { Secret } from './secret.ts';

const id = (n: number): Id =>
  parseId(`0190f3e2-7a1b-7c3d-8e4f-${String(n).padStart(12, '0')}`) as Id;
const tenant = parseTenantId(id(1)) as TenantId;
function context(actor: Actor = { kind: 'user', userId: id(2) }): TenantContext {
  const checked = requireTenant(
    createContext({
      tenantId: tenant,
      actor,
      correlationId: parseCorrelationId('t') as CorrelationId,
      clock: { nowMillis: () => 0, monotonicMillis: () => 0 },
    }),
  );
  if (!checked.ok) throw new Error('fixture');
  return checked.value;
}

describe('Secret', () => {
  const secret = Secret.of('s3cr3t-value');

  it('prints as [secret] through every common path', () => {
    for (const printed of [
      String(secret),
      String(secret),
      JSON.stringify({ secret }),
      inspect(secret),
      inspect([{ secret }], { depth: 5 }),
    ]) {
      expect(printed).not.toContain('s3cr3t-value');
      expect(printed).toContain('[secret]');
    }
  });

  it('leaks nothing through spreading, cloning or own keys', () => {
    // Spreading a class instance on purpose: it must copy nothing secret.
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
    expect(JSON.stringify({ ...secret })).not.toContain('s3cr3t');
    expect(JSON.stringify(structuredClone(secret))).not.toContain('s3cr3t');
    expect(Object.keys(secret)).toEqual([]);
  });

  it('reveals the value only on request, and refuses an empty secret', () => {
    expect(secret.reveal()).toBe('s3cr3t-value');
    expect(() => Secret.of('')).toThrow(TypeError);
  });
});

describe('authorize and isAllowed fail closed', () => {
  it.each([undefined, null, true, 'allow', { allow: 'true' }, { allow: 1 }, {}])(
    'treats %j as a deny',
    (answer) => {
      expect(isAllowed(answer)).toBe(false);
    },
  );

  it('passes through a real allow and a known deny reason', async () => {
    expect(
      await authorize({ can: () => Promise.resolve(ALLOW) }, context(), 'x.read', { type: 'x' }),
    ).toEqual({ allow: true });
    expect(
      await authorize({ can: () => Promise.resolve(deny('NO_GRANT')) }, context(), 'x.read', {
        type: 'x',
      }),
    ).toEqual({ allow: false, reason: 'NO_GRANT' });
  });

  it('turns a throw, a boolean or an unknown reason into AUTHORIZER_FAILED', async () => {
    for (const can of [
      () => Promise.reject(new Error('down')),
      () => Promise.resolve(true as never),
      () => Promise.resolve({ allow: false, reason: 'MADE_UP' } as never),
    ]) {
      expect(await authorize({ can }, context(), 'x.read', { type: 'x' })).toEqual({
        allow: false,
        reason: 'AUTHORIZER_FAILED',
      });
    }
  });
});

describe('actorCeiling', () => {
  it('lets anyone reach the grant check for a read', () => {
    expect(
      actorCeiling({ kind: 'operator', operatorId: id(3), supportSessionId: id(4) }, 'read'),
    ).toBeUndefined();
  });

  it('stops an AI client without the write scope, and an operator, from writing', () => {
    const viaRead: Actor = {
      kind: 'user',
      userId: id(2),
      via: { kind: 'ai_client', clientId: 'c' as never, scopes: ['read'] },
    };
    const viaWrite: Actor = {
      kind: 'user',
      userId: id(2),
      via: { kind: 'ai_client', clientId: 'c' as never, scopes: ['read', 'write'] },
    };
    expect(actorCeiling(viaRead, 'write')).toBe('SCOPE_EXCEEDED');
    expect(actorCeiling(viaWrite, 'write')).toBeUndefined();
    expect(
      actorCeiling({ kind: 'operator', operatorId: id(3), supportSessionId: id(4) }, 'write'),
    ).toBe('SUPPORT_READ_ONLY');
    expect(actorCeiling({ kind: 'user', userId: id(2) }, 'write')).toBeUndefined();
  });
});

describe('checkEntitlement fails closed', () => {
  it('turns a throw or a malformed answer into GATE_FAILED', async () => {
    expect(
      await checkEntitlement({ check: () => Promise.reject(new Error('down')) }, context(), 'k'),
    ).toEqual({ enabled: false, reason: 'GATE_FAILED' });
    expect(
      await checkEntitlement(
        { check: () => Promise.resolve({ enabled: 'yes' } as never) },
        context(),
        'k',
      ),
    ).toEqual({ enabled: false, reason: 'GATE_FAILED' });
  });
});

describe('small rules', () => {
  it.each([
    [1, true],
    [1_000, true],
    [0, false],
    [-1, false],
    [1.5, false],
    [Number.NaN, false],
    [2 ** 60, false],
  ])('quota amount %s valid: %s', (amount, valid) => {
    expect(isValidQuotaAmount(amount)).toBe(valid);
  });

  it('orders data classes from public to secret', () => {
    expect(atLeast('secret', 'personal')).toBe(true);
    expect(atLeast('internal', 'personal')).toBe(false);
  });

  it('masks an address down to its last 2 characters', () => {
    expect(maskAddress('+919876543210')).toBe('********10');
    expect(maskAddress('ab')).toBe('ab');
  });

  it('requires purpose, consent and a template id before sending', () => {
    const base = {
      channel: 'sms',
      to: '+91 98765 43210',
      template: 'otp_v1',
      params: {},
      purpose: 'otp',
      consentRef: 'basis:contract',
    } as const;
    expect(validateOutgoing(base)).toBeUndefined();
    expect(validateOutgoing({ ...base, consentRef: '' })?.fields).toEqual([
      { path: 'consentRef', code: 'REQUIRED' },
    ]);
  });
});
