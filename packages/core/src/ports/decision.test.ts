import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Clock } from '../clock.ts';
import {
  createContext,
  parseCorrelationId,
  parseTenantId,
  requireTenant,
  type Actor,
  type CorrelationId,
  type TenantContext,
  type TenantId,
} from '../context.ts';
import { parseId, type Id } from '../ids.ts';
import { actorModeDenial, authorize, type Authorizer } from './authorizer.ts';
import { ALLOW, denialReason, deny, isAllowed, settleDecision } from './decision.ts';
import { checkEntitlement, type EntitlementGate } from './entitlements.ts';
import { consumeQuota, isQuotaAmount, type QuotaProvider } from './quotas.ts';

const clock: Clock = { nowMillis: () => 0, monotonicMillis: () => 0 };
const id = (value: string): Id => parseId(value) as Id;
const TENANT = parseTenantId('0190f3e2-7a1b-7c3d-8e4f-0000000000a1') as TenantId;
const USER = id('0190f3e2-7a1b-7c3d-8e4f-0000000000b1');
const correlationId = parseCorrelationId('req-1') as CorrelationId;

function tenantContext(actor: Actor = { kind: 'user', userId: USER }): TenantContext {
  const result = requireTenant(createContext({ tenantId: TENANT, actor, correlationId, clock }));
  if (!result.ok) throw new Error('fixture context has no tenant');
  return result.value;
}

const request = { permission: 'invoice.read' } as const;

describe('isAllowed', () => {
  it('accepts only an object whose allow is exactly true', () => {
    expect(isAllowed(ALLOW)).toBe(true);
    expect(isAllowed({ allow: true })).toBe(true);
    for (const value of [
      true,
      1,
      'allow',
      'true',
      undefined,
      null,
      {},
      { allow: 'true' },
      { allow: 1 },
      { allowed: true },
      deny('NO_GRANT'),
      [true],
    ]) {
      expect(isAllowed(value)).toBe(false);
    }
  });

  it('never accepts a value without allow === true (property)', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const hasExactTrue =
          typeof value === 'object' &&
          value !== null &&
          (value as { allow?: unknown }).allow === true;
        expect(isAllowed(value)).toBe(hasExactTrue);
      }),
    );
  });

  it('is false, not a throw, when reading allow throws', () => {
    const hostile = {
      get allow(): boolean {
        throw new Error('boom');
      },
    };
    expect(isAllowed(hostile)).toBe(false);
  });
});

describe('deny and ALLOW', () => {
  it('are frozen tagged values', () => {
    expect(Object.isFrozen(ALLOW)).toBe(true);
    const denial = deny('NO_GRANT');
    expect(denial).toEqual({ allow: false, reason: 'NO_GRANT' });
    expect(Object.isFrozen(denial)).toBe(true);
  });
});

describe('authorize', () => {
  const adapter = (check: Authorizer['check']): Authorizer => ({ check });

  it('passes an allow through', async () => {
    const decision = await authorize(
      adapter(() => Promise.resolve(ALLOW)),
      tenantContext(),
      request,
    );
    expect(decision).toEqual({ allow: true });
  });

  it('passes a known denial through', async () => {
    const decision = await authorize(
      adapter(() => Promise.resolve(deny('NO_GRANT'))),
      tenantContext(),
      request,
    );
    expect(decision).toEqual({ allow: false, reason: 'NO_GRANT' });
  });

  it('turns a rejected promise into a denial that keeps the cause', async () => {
    const failure = new Error('database down');
    const decision = await authorize(
      adapter(() => Promise.reject(failure)),
      tenantContext(),
      request,
    );
    expect(decision).toEqual({ allow: false, reason: 'ERROR', cause: failure });
  });

  it('turns a synchronous throw into a denial', async () => {
    const decision = await authorize(
      adapter(() => {
        throw new Error('bug');
      }),
      tenantContext(),
      request,
    );
    expect(decision.allow).toBe(false);
    expect(!decision.allow && decision.reason).toBe('ERROR');
  });

  it.each([
    ['true', true],
    ['undefined', undefined],
    ['null', null],
    ['a string', 'allow'],
    ['allow as a string', { allow: 'true' }],
    ['a made-up denial reason', { allow: false, reason: 'MAYBE' }],
    ['a denial without a reason', { allow: false }],
  ])('denies when the adapter returns %s', async (_label, value) => {
    const decision = await authorize(
      adapter(() => Promise.resolve(value as never)),
      tenantContext(),
      request,
    );
    expect(decision.allow).toBe(false);
    expect(!decision.allow && decision.reason).toBe('ERROR');
  });

  it('returns a fresh frozen allow, dropping extra fields an adapter added', async () => {
    const decision = await authorize(
      adapter(() => Promise.resolve({ allow: true, reason: 'NO_GRANT' } as never)),
      tenantContext(),
      request,
    );
    expect(decision).toEqual({ allow: true });
    expect(Object.isFrozen(decision)).toBe(true);
  });
});

describe('actorModeDenial', () => {
  const via = (scopes: readonly ('read' | 'write')[]): Actor => ({
    kind: 'user',
    userId: USER,
    via: { kind: 'ai_client', clientId: 'client-1' as never, scopes },
  });
  const operator: Actor = { kind: 'operator', operatorId: USER, supportSessionId: USER };

  it.each([
    ['anonymous read', { kind: 'anonymous' }, 'read', 'UNAUTHENTICATED'],
    ['anonymous write', { kind: 'anonymous' }, 'write', 'UNAUTHENTICATED'],
    ['operator write', operator, 'write', 'OPERATOR_READ_ONLY'],
    ['AI client with read scope writing', via(['read']), 'write', 'SCOPE_EXCEEDED'],
    ['AI client with write scope reading', via(['write']), 'read', 'SCOPE_EXCEEDED'],
    ['AI client with no scopes', via([]), 'read', 'SCOPE_EXCEEDED'],
  ] as const)('denies %s', (_label, actor, mode, reason) => {
    expect(actorModeDenial(actor, mode)).toEqual({ allow: false, reason });
  });

  it.each([
    ['user read', { kind: 'user', userId: USER }, 'read'],
    ['user write', { kind: 'user', userId: USER }, 'write'],
    ['operator read', operator, 'read'],
    ['AI client with read scope reading', via(['read']), 'read'],
    ['AI client with both scopes writing', via(['read', 'write']), 'write'],
    ['service account write', { kind: 'service_account', serviceAccountId: USER }, 'write'],
    ['system process write', { kind: 'system', process: 'scheduler' }, 'write'],
  ] as const)('leaves %s to the grants', (_label, actor, mode) => {
    expect(actorModeDenial(actor, mode)).toBeUndefined();
  });
});

describe('checkEntitlement', () => {
  const gate = (check: EntitlementGate['check']): EntitlementGate => ({ check });

  it('turns a throw into a denial', async () => {
    const decision = await checkEntitlement(
      gate(() => Promise.reject(new Error('cache down'))),
      tenantContext(),
      'module.invoicing',
    );
    expect(!decision.allow && decision.reason).toBe('ERROR');
  });

  it('turns a boolean into a denial', async () => {
    const decision = await checkEntitlement(
      gate(() => Promise.resolve(true as never)),
      tenantContext(),
      'module.invoicing',
    );
    expect(!decision.allow && decision.reason).toBe('ERROR');
  });

  it('passes known outcomes through', async () => {
    const allowed = await checkEntitlement(
      gate(() => Promise.resolve(ALLOW)),
      tenantContext(),
      'module.invoicing',
    );
    const unknown = await checkEntitlement(
      gate(() => Promise.resolve(deny('UNKNOWN_KEY'))),
      tenantContext(),
      'module.invoicing',
    );
    expect(allowed).toEqual({ allow: true });
    expect(unknown).toEqual({ allow: false, reason: 'UNKNOWN_KEY' });
  });
});

describe('isQuotaAmount', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, '1', null])(
    'rejects %s',
    (value) => {
      expect(isQuotaAmount(value)).toBe(false);
    },
  );

  it.each([1, 2, Number.MAX_SAFE_INTEGER])('accepts %s', (value) => {
    expect(isQuotaAmount(value)).toBe(true);
  });
});

describe('consumeQuota', () => {
  const use = { quota: 'api.calls', amount: 1, idempotencyKey: 'request-1' };
  const provider = (consume: QuotaProvider['consume']): QuotaProvider => ({ consume });

  it('rejects an invalid amount without asking the provider', async () => {
    let calls = 0;
    const counting = provider(() => {
      calls += 1;
      return Promise.resolve({ allow: true, remaining: 10 });
    });
    for (const amount of [0, -5, 0.5, Number.NaN]) {
      const decision = await consumeQuota(counting, tenantContext(), {
        quota: 'api.calls',
        amount,
        idempotencyKey: 'k1',
      });
      expect(decision).toEqual({ allow: false, reason: 'INVALID_AMOUNT' });
    }
    expect(calls).toBe(0);
  });

  it('passes a grant with its remaining amount through', async () => {
    const decision = await consumeQuota(
      provider(() => Promise.resolve({ allow: true, remaining: 4 })),
      tenantContext(),
      use,
    );
    expect(decision).toEqual({ allow: true, remaining: 4 });
  });

  it.each([
    ['a negative remaining amount', { allow: true, remaining: -1 }],
    ['an unlimited remaining amount', { allow: true, remaining: Number.POSITIVE_INFINITY }],
    ['no remaining amount', { allow: true }],
    ['a boolean', true],
  ])('denies when the provider returns %s', async (_label, value) => {
    const decision = await consumeQuota(
      provider(() => Promise.resolve(value as never)),
      tenantContext(),
      use,
    );
    expect(!decision.allow && decision.reason).toBe('ERROR');
  });

  it('turns a throw into a denial', async () => {
    const decision = await consumeQuota(
      provider(() => Promise.reject(new Error('counter down'))),
      tenantContext(),
      use,
    );
    expect(!decision.allow && decision.reason).toBe('ERROR');
  });
});

describe('prototype pollution', () => {
  it('never reads a polluted Object.prototype as an allow or a reason', async () => {
    const proto = Object.prototype as Record<string, unknown>;
    proto['allow'] = true;
    proto['reason'] = 'NO_GRANT';
    try {
      expect(isAllowed({ reason: 'x' })).toBe(false);
      expect(isAllowed({})).toBe(false);
      expect(denialReason({ allow: false }, ['NO_GRANT'])).toBeUndefined();
      const settled = await settleDecision(['NO_GRANT'], () => Promise.resolve({}));
      expect(settled.allow).toBe(false);
      expect(!settled.allow && settled.reason).toBe('ERROR');
    } finally {
      delete proto['allow'];
      delete proto['reason'];
    }
  });
});
