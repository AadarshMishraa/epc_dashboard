import { describe, expect, it } from 'vitest';
import type { Clock } from './clock.ts';
import {
  correlationIdFromId,
  createContext,
  deriveContext,
  parseAiClientId,
  parseCorrelationId,
  parseTenantId,
  requireTenant,
  type Actor,
  type AiClientId,
  type Context,
  type CorrelationId,
  type TenantContext,
  type TenantId,
} from './context.ts';
import { parseId, type Id } from './ids.ts';

const clock: Clock = { nowMillis: () => 0, monotonicMillis: () => 0 };
const id = (value: string): Id => {
  const parsed = parseId(value);
  if (parsed === undefined) throw new Error(`bad fixture id ${value}`);
  return parsed;
};
const TENANT = parseTenantId('0190f3e2-7a1b-7c3d-8e4f-000000000001') as TenantId;
const USER = id('0190f3e2-7a1b-7c3d-8e4f-000000000002');
const EVENT = id('0190f3e2-7a1b-7c3d-8e4f-000000000003');
const correlation = parseCorrelationId('req-123') as CorrelationId;
const user: Actor = { kind: 'user', userId: USER };

describe('createContext', () => {
  it('carries tenant, actor, correlation id and clock', () => {
    const context = createContext({
      tenantId: TENANT,
      actor: user,
      correlationId: correlation,
      clock,
    });
    expect(context).toEqual({ tenantId: TENANT, actor: user, correlationId: correlation, clock });
  });

  it('is immutable, including the actor', () => {
    const context = createContext({ actor: user, correlationId: correlation, clock });
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.actor)).toBe(true);
  });

  it('does not share the caller’s actor object', () => {
    const actor = { kind: 'user' as const, userId: USER };
    const context = createContext({ actor, correlationId: correlation, clock });
    expect(context.actor).not.toBe(actor);
  });

  it('records an AI client acting for a user (ADR-0005)', () => {
    const viaClient: Actor = {
      kind: 'user',
      userId: USER,
      via: {
        kind: 'ai_client',
        clientId: parseAiClientId('https://claude.ai/client') as AiClientId,
        scopes: ['read'],
      },
    };
    const context = createContext({
      tenantId: TENANT,
      actor: viaClient,
      correlationId: correlation,
      clock,
    });
    expect(context.actor).toEqual(viaClient);
  });
});

describe('deriveContext for jobs and event handlers', () => {
  const parent = createContext({
    tenantId: TENANT,
    actor: user,
    correlationId: correlation,
    clock,
  });

  it('keeps tenant, actor and correlation id and records the cause', () => {
    const child = deriveContext(parent, { causationId: EVENT });
    expect(child).toEqual({
      tenantId: TENANT,
      actor: user,
      correlationId: correlation,
      causationId: EVENT,
      clock,
    });
  });

  it('can run as a system process without losing the tenant', () => {
    const child = deriveContext(parent, {
      causationId: EVENT,
      actor: { kind: 'system', process: 'k6-events.dispatcher' },
    });
    expect(child.tenantId).toBe(TENANT);
    expect(child.actor).toEqual({ kind: 'system', process: 'k6-events.dispatcher' });
  });

  it('keeps a platform context tenant-less rather than inventing one', () => {
    const platform = createContext({
      actor: { kind: 'system', process: 'boot' },
      correlationId: correlation,
      clock,
    });
    expect(deriveContext(platform, { causationId: EVENT }).tenantId).toBeUndefined();
  });
});

describe('requireTenant', () => {
  it('returns the tenant when present', () => {
    const context = createContext({
      tenantId: TENANT,
      actor: user,
      correlationId: correlation,
      clock,
    });
    const result = requireTenant(context);
    expect(result.ok && result.value.tenantId).toBe(TENANT);
    expect(result.ok && result.value).toBe(context);
  });

  it('fails closed with TENANT_REQUIRED when absent; there is no default tenant', () => {
    const result = requireTenant(createContext({ actor: user, correlationId: correlation, clock }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('TENANT_REQUIRED');
      expect(result.error.status).toBe(403);
    }
  });
});

describe('parseCorrelationId', () => {
  it.each([
    'req-123',
    'a',
    '0190f3e2-7a1b-7c3d-8e4f-0123456789ab',
    'trace:span.1_2',
    'x'.repeat(128),
    'bom1::iad1::8n2xq-1762300000000-5d4a6f3c1b2e',
  ])('accepts %s', (value) => {
    expect(parseCorrelationId(value)).toBe(value);
  });

  it.each([
    ['empty', ''],
    ['too long', 'x'.repeat(129)],
    ['newline (log injection)', 'abc\nlevel=error forged'],
    ['space', 'a b'],
    ['markup', '<script>'],
    ['non-ASCII', 'réq'],
    ['not a string', 42],
    ['a phone number, which logs would mask', '9876543210'],
    ['a long number', '1762300000000'],
    ['an embedded national id', 'req-2345-6789-0123'],
  ])('rejects %s', (_label, value) => {
    expect(parseCorrelationId(value)).toBeUndefined();
  });
});

describe('review fixes: brands and narrowing', () => {
  it('does not accept a plain record id as a tenant id', () => {
    // @ts-expect-error a user or record id is not a tenant id
    const wrong: TenantId = USER;
    expect(wrong).toBe(USER);
  });

  it('parseTenantId accepts only canonical ids', () => {
    expect(parseTenantId('not-an-id')).toBeUndefined();
    expect(parseTenantId(42)).toBeUndefined();
  });

  it('tenant-scoped code must take a TenantContext, which only requireTenant gives', () => {
    const scoped = (context: TenantContext): TenantId => context.tenantId;
    const context: Context = createContext({
      tenantId: TENANT,
      actor: user,
      correlationId: correlation,
      clock,
    });
    // @ts-expect-error a Context, even with a tenant, has not been checked
    expect(() => scoped(context)).not.toThrow();
    const checked = requireTenant(context);
    expect(checked.ok && scoped(checked.value)).toBe(TENANT);
  });

  it('mints a correlation id from a fresh id', () => {
    expect(parseCorrelationId(correlationIdFromId(EVENT))).toBe(EVENT);
  });

  it.each(['claude', 'https://chatgpt.com/connector/abc?v=1', 'client_01'])(
    'accepts AI client id %s',
    (value) => {
      expect(parseAiClientId(value)).toBe(value);
    },
  );

  it.each(['', 'a b', 'x\nforged', '<script>', '"quoted"', 'é', 'x'.repeat(257)])(
    'rejects AI client id %j',
    (value) => {
      expect(parseAiClientId(value)).toBeUndefined();
    },
  );

  it('freezes the AI client and its scopes, not only the actor', () => {
    const scopes: ('read' | 'write')[] = ['read'];
    const clientId = parseAiClientId('c') as AiClientId;
    const context = createContext({
      actor: { kind: 'user', userId: USER, via: { kind: 'ai_client', clientId, scopes } },
      correlationId: correlation,
      clock,
    });
    scopes.push('write');
    const actor = context.actor;
    expect(actor.kind === 'user' && actor.via?.scopes).toEqual(['read']);
    expect(actor.kind === 'user' && Object.isFrozen(actor.via)).toBe(true);
  });

  it('keeps who started the chain when a system process takes over', () => {
    const parent = createContext({
      tenantId: TENANT,
      actor: user,
      correlationId: correlation,
      clock,
    });
    const job = deriveContext(parent, {
      causationId: EVENT,
      actor: { kind: 'system', process: 'k6.jobs' },
    });
    const retry = deriveContext(job, {
      causationId: EVENT,
      actor: { kind: 'system', process: 'k6.retry' },
    });
    expect(job.initiatedBy).toEqual(user);
    expect(retry.initiatedBy).toEqual(user);
    expect(deriveContext(parent, { causationId: EVENT }).initiatedBy).toBeUndefined();
  });

  it('keeps the TenantContext type through deriveContext', () => {
    const base = createContext({
      tenantId: TENANT,
      actor: user,
      correlationId: correlation,
      clock,
    });
    const checked = requireTenant(base);
    if (!checked.ok) throw new Error('fixture has a tenant');
    const child: TenantContext = deriveContext(checked.value, { causationId: EVENT });
    expect(child.tenantId).toBe(TENANT);
  });
});
