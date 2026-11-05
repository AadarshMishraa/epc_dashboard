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
import { coreError } from '../errors.ts';
import { parseId, type Id } from '../ids.ts';
import { err, ok } from '../result.ts';
import { createAuditRecord, prepareAuditEntry } from './audit.ts';
import { actorModeDenial, authorize } from './authorizer.ts';
import { isErasureComplete, runEraser, type ErasureOutcome } from './erasure.ts';
import { createEventEnvelope, prepareEvent } from './events.ts';
import { toFrozenJson } from './json.ts';
import { prepareMessage } from './messages.ts';
import { consumeQuota } from './quotas.ts';

const clock: Clock = { nowMillis: () => 0, monotonicMillis: () => 0 };
const TENANT = parseTenantId('0190f3e2-7a1b-7c3d-8e4f-0000000000a1') as TenantId;
const USER = parseId('0190f3e2-7a1b-7c3d-8e4f-0000000000b1') as Id;
const OTHER = parseId('0190f3e2-7a1b-7c3d-8e4f-0000000000b2') as Id;
const correlationId = parseCorrelationId('req-1') as CorrelationId;

function tenantContext(actor: Actor = { kind: 'user', userId: USER }): TenantContext {
  const result = requireTenant(createContext({ tenantId: TENANT, actor, correlationId, clock }));
  if (!result.ok) throw new Error('fixture context has no tenant');
  return result.value;
}

/** A context assembled by hand, as a job runner might, with a mutable actor. */
function handBuiltContext(actor: { kind: 'user'; userId: Id }): TenantContext {
  const result = requireTenant({ tenantId: TENANT, actor, correlationId, clock });
  if (!result.ok) throw new Error('fixture context has no tenant');
  return result.value;
}

describe('actorModeDenial on malformed actors', () => {
  it('denies an actor kind it does not know', () => {
    const unknown = { kind: 'robot' } as unknown as Actor;
    expect(actorModeDenial(unknown, 'read')).toEqual({ allow: false, reason: 'UNAUTHENTICATED' });
  });

  it('denies an AI client whose scopes arrive as a string', () => {
    const actor = {
      kind: 'user',
      userId: USER,
      via: { kind: 'ai_client', clientId: 'c', scopes: 'readonly' },
    } as unknown as Actor;
    expect(actorModeDenial(actor, 'read')).toEqual({ allow: false, reason: 'SCOPE_EXCEEDED' });
  });
});

describe('authorize with an anonymous caller', () => {
  it('denies without asking the adapter', async () => {
    let asked = false;
    const decision = await authorize(
      {
        check: () => {
          asked = true;
          return Promise.resolve({ allow: true });
        },
      },
      tenantContext({ kind: 'anonymous' }),
      { permission: 'invoice.read' },
    );
    expect(decision).toEqual({ allow: false, reason: 'UNAUTHENTICATED' });
    expect(asked).toBe(false);
  });
});

describe('authorize with a malformed context', () => {
  it('returns a denial instead of throwing', async () => {
    const broken = { tenantId: TENANT, correlationId, clock } as unknown as TenantContext;
    const decision = await authorize({ check: () => Promise.resolve({ allow: true }) }, broken, {
      permission: 'invoice.read',
    });
    expect(!decision.allow && decision.reason).toBe('ERROR');
  });
});

describe('consumeQuota hardening', () => {
  it.each([
    ['blank', '  '],
    ['empty', ''],
    ['too long', 'k'.repeat(256)],
  ])('rejects a %s idempotency key without asking the provider', async (_label, key) => {
    let asked = false;
    const decision = await consumeQuota(
      {
        consume: () => {
          asked = true;
          return Promise.resolve({ allow: true, remaining: 1 });
        },
      },
      tenantContext(),
      { quota: 'api.calls', amount: 1, idempotencyKey: key },
    );
    expect(decision).toEqual({ allow: false, reason: 'INVALID_KEY' });
    expect(asked).toBe(false);
  });

  it('denies, instead of rejecting, when reading the answer throws', async () => {
    const hostile = {
      get allow(): boolean {
        throw new Error('getter');
      },
    };
    const decision = await consumeQuota(
      { consume: () => Promise.resolve(hostile as never) },
      tenantContext(),
      { quota: 'api.calls', amount: 1, idempotencyKey: 'k' },
    );
    expect(!decision.allow && decision.reason).toBe('ERROR');
  });
});

describe('toFrozenJson hardening', () => {
  it('rejects a graph that reuses nodes into an exponential copy, quickly', () => {
    let node: Record<string, unknown> = { leaf: 1 };
    for (let i = 0; i < 40; i += 1) node = { left: node, right: node };
    const started = performance.now();
    const result = toFrozenJson(node);
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.fields[0]?.code).toBe('too_large');
  });

  it('returns VALIDATION_FAILED when a getter throws', () => {
    const value = {
      get boom(): string {
        throw new Error('getter');
      },
    };
    const result = toFrozenJson(value);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.fields[0]?.code).toBe('unreadable');
  });

  it('returns VALIDATION_FAILED when a proxy trap throws', () => {
    const value = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('trap');
        },
      },
    );
    expect(toFrozenJson(value).ok).toBe(false);
  });
});

describe('records keep their own frozen actor', () => {
  it('an audit record does not change when the caller mutates the actor afterwards', () => {
    const actor = { kind: 'user' as const, userId: USER };
    const prepared = prepareAuditEntry({ action: 'invoice.issue', outcome: 'succeeded' });
    if (!prepared.ok) throw new Error('fixture invalid');
    const record = createAuditRecord(handBuiltContext(actor), prepared.value, OTHER);
    actor.userId = OTHER;
    expect(record.actor).toEqual({ kind: 'user', userId: USER });
    expect(Object.isFrozen(record.actor)).toBe(true);
  });

  it('an event envelope does not change when the caller mutates the actor afterwards', () => {
    const actor = { kind: 'user' as const, userId: USER };
    const prepared = prepareEvent({ name: 'invoice.issued', version: 1, payload: {} });
    if (!prepared.ok) throw new Error('fixture invalid');
    const envelope = createEventEnvelope(handBuiltContext(actor), prepared.value, OTHER);
    actor.userId = OTHER;
    expect(envelope.actor).toEqual({ kind: 'user', userId: USER });
    expect(Object.isFrozen(envelope.actor)).toBe(true);
  });
});

describe('prepare helpers return errors for null parts', () => {
  it('an audit target of null is a field error, not a throw', () => {
    const result = prepareAuditEntry({
      action: 'invoice.issue',
      outcome: 'succeeded',
      target: null as never,
    });
    expect(!result.ok && result.error.fields.map((f) => f.path)).toEqual(['target']);
  });

  it('message params of null are a field error, not a throw', () => {
    const result = prepareMessage({
      channel: 'email',
      to: 'a@example.com',
      template: 'welcome',
      purpose: 'onboarding',
      consentRef: 'consent-1',
      params: null as never,
    });
    expect(!result.ok && result.error.fields.map((f) => f.path)).toEqual(['params']);
  });
});

describe('runEraser', () => {
  const context = tenantContext();
  const subject = { subjectId: USER };
  const run = (erase: () => Promise<unknown>): Promise<ErasureOutcome> =>
    runEraser('k8-files', erase as never, context, subject);

  it('reports erased', async () => {
    expect(await run(() => Promise.resolve(ok({ status: 'erased' })))).toEqual({
      handlerId: 'k8-files',
      status: 'erased',
    });
  });

  it('reports retained with its legal basis', async () => {
    const outcome = await run(() =>
      Promise.resolve(ok({ status: 'retained', basis: 'CGST Act s.36 (6 years)' })),
    );
    expect(outcome).toEqual({
      handlerId: 'k8-files',
      status: 'retained',
      basis: 'CGST Act s.36 (6 years)',
    });
  });

  it.each([
    ['a retention without a basis', () => Promise.resolve(ok({ status: 'retained', basis: ' ' }))],
    ['an unknown status', () => Promise.resolve(ok({ status: 'skipped' }))],
    ['undefined', () => Promise.resolve(undefined)],
    ['a bare true', () => Promise.resolve(true)],
    ['a throw', () => Promise.reject(new Error('crash'))],
    [
      'a result whose getter throws',
      () =>
        Promise.resolve({
          get ok(): boolean {
            throw new Error('getter');
          },
        }),
    ],
  ])('turns %s into failed INTERNAL', async (_label, erase) => {
    const outcome = await run(erase);
    expect(outcome.status).toBe('failed');
    expect(outcome.status === 'failed' && outcome.error.code).toBe('INTERNAL');
  });

  it('keeps the handler’s own error', async () => {
    const error = coreError('DEPENDENCY_UNAVAILABLE', { detail: 'storage down' });
    expect(await run(() => Promise.resolve(err(error)))).toEqual({
      handlerId: 'k8-files',
      status: 'failed',
      error,
    });
  });
});

describe('isErasureComplete', () => {
  it('needs at least one handler and no failure', () => {
    const erased = { handlerId: 'a', status: 'erased' } as const;
    const retained = { handlerId: 'b', status: 'retained', basis: 'law' } as const;
    const failed = { handlerId: 'c', status: 'failed', error: coreError('INTERNAL') } as const;
    expect(isErasureComplete([])).toBe(false);
    expect(isErasureComplete([erased, retained])).toBe(true);
    expect(isErasureComplete([erased, failed])).toBe(false);
  });
});
