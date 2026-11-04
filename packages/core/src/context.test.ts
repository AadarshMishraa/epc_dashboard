import { describe, expect, it } from 'vitest';
import type { Clock } from './clock.ts';
import {
  createContext,
  deriveContext,
  parseCorrelationId,
  requireTenant,
  type Actor,
  type CorrelationId,
} from './context.ts';
import { parseId, type Id } from './ids.ts';

const clock: Clock = { nowMillis: () => 0 };
const id = (value: string): Id => {
  const parsed = parseId(value);
  if (parsed === undefined) throw new Error(`bad fixture id ${value}`);
  return parsed;
};
const TENANT = id('0190f3e2-7a1b-7c3d-8e4f-000000000001');
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
      via: { kind: 'ai_client', clientId: 'claude' },
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
    expect(requireTenant(context)).toEqual({ ok: true, value: TENANT });
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
  ])('rejects %s', (_label, value) => {
    expect(parseCorrelationId(value)).toBeUndefined();
  });
});
