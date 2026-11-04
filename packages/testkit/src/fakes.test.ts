import { authorize, coreError, createContext, type Context } from '@gx/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { TEST_CORRELATION, tenantContext, testId, testTenant } from './context.ts';
import { frozenClock } from './clock.ts';
import {
  auditSinkContract,
  authorizerContract,
  classificationLookupContract,
  entitlementGateContract,
  eraserRegistryContract,
  eventPublisherContract,
  fakeAuditSink,
  fakeAuthorizer,
  fakeClassificationLookup,
  fakeEntitlementGate,
  fakeEventPublisher,
  fakeMessageSender,
  fakeQuotaProvider,
  fakeSecretsProvider,
  inMemoryEraserRegistry,
  messageSenderContract,
  quotaProviderContract,
  secretsProviderContract,
} from './index.ts';

// The 9 core ports' contract suites, run against the fakes (F-02-AC2: 9 of 9 pass).
authorizerContract('fakeAuthorizer', fakeAuthorizer);
entitlementGateContract('fakeEntitlementGate', fakeEntitlementGate);
quotaProviderContract('fakeQuotaProvider', (seed) => {
  const shared = fakeQuotaProvider(seed);
  return { instance: () => shared };
});
classificationLookupContract('fakeClassificationLookup', fakeClassificationLookup);
secretsProviderContract('fakeSecretsProvider', fakeSecretsProvider);
auditSinkContract('fakeAuditSink', (clock) => {
  const sink = fakeAuditSink({ clock });
  return { sink, records: (t) => sink.records(t) };
});
eventPublisherContract('fakeEventPublisher', (clock) => {
  const publisher = fakeEventPublisher({ clock });
  return { publisher, published: (t) => publisher.published(t) };
});
messageSenderContract('fakeMessageSender', (clock) => {
  const sender = fakeMessageSender({ clock });
  return { sender, sent: (t) => sender.sent(t) };
});
eraserRegistryContract('inMemoryEraserRegistry', (options) => inMemoryEraserRegistry(options));

describe('fakes beyond the contracts', () => {
  it('property: no permission string is ever allowed without an explicit grant', async () => {
    const authorizer = fakeAuthorizer({ permissions: { 'invoice.read': 'read' }, grants: [] });
    await fc.assert(
      fc.asyncProperty(fc.string(), async (permission) => {
        expect((await authorizer.can(tenantContext(), permission, { type: 'x' })).allow).toBe(
          false,
        );
      }),
      { seed: 20261104, numRuns: 200 },
    );
  });

  it('passes an injected audit failure to the caller, so critical actions can fail closed', async () => {
    const sink = fakeAuditSink({ clock: frozenClock() });
    sink.failNext(coreError('DEPENDENCY_UNAVAILABLE'));
    const entry = {
      action: 'invoice.issue',
      resource: { type: 'invoice' },
      outcome: 'success',
    } as const;
    const result = await sink.append(tenantContext(), entry);
    expect(!result.ok && result.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(await sink.records(testTenant(1))).toEqual([]);
    expect((await sink.append(tenantContext(), entry)).ok).toBe(true);
  });

  it('turns an Authorizer that throws or answers badly into a deny', async () => {
    const throwing = { can: () => Promise.reject(new Error('db down')) };
    const malformed = { can: () => Promise.resolve(true as never) };
    expect(await authorize(throwing, tenantContext(), 'invoice.read', { type: 'invoice' })).toEqual(
      { allow: false, reason: 'AUTHORIZER_FAILED' },
    );
    expect(
      await authorize(malformed, tenantContext(), 'invoice.read', { type: 'invoice' }),
    ).toEqual({ allow: false, reason: 'AUTHORIZER_FAILED' });
  });

  it('accepts only a checked TenantContext on tenant-scoped ports', () => {
    const authorizer = fakeAuthorizer();
    const unchecked: Context = createContext({
      tenantId: testTenant(1),
      actor: { kind: 'user', userId: testId(1) },
      correlationId: TEST_CORRELATION,
      clock: frozenClock(),
    });
    // @ts-expect-error a plain Context has not been through requireTenant
    void authorizer.can(unchecked, 'invoice.read', { type: 'invoice' });
    // @ts-expect-error same for the secrets provider
    void fakeSecretsProvider().forTenant(unchecked, 'x');
    expect(true).toBe(true);
  });

  it('freezes what it stores, so later edits by the caller cannot rewrite history', async () => {
    const publisher = fakeEventPublisher({ clock: frozenClock() });
    const result = await publisher.publish(tenantContext(), {
      type: 'x.happened',
      version: 1,
      payload: { a: 1 },
    });
    expect(result.ok && Object.isFrozen(result.value)).toBe(true);
    expect(result.ok && Object.isFrozen(result.value.payload)).toBe(true);
  });
});

describe('security review fixes', () => {
  it('rejects a payload that cannot be stored as data, instead of throwing', async () => {
    const publisher = fakeEventPublisher({ clock: frozenClock() });
    const result = await publisher.publish(tenantContext(), {
      type: 'x.happened',
      version: 1,
      payload: { f: (() => 1) as never },
    });
    expect(!result.ok && result.error.code).toBe('VALIDATION_FAILED');
  });

  it.each([Number.NaN, -1, 1.5])('refuses a quota seed limit of %s', (limit) => {
    expect(() =>
      fakeQuotaProvider({ limits: [{ tenantId: testTenant(1), quota: 'q', limit }] }),
    ).toThrow(RangeError);
  });
});

describe('frozenClock', () => {
  it('advances exactly 24 hours when told to (F-03-AC4)', () => {
    const clock = frozenClock(0);
    clock.advance(24 * 60 * 60 * 1000);
    expect(clock.nowMillis()).toBe(86_400_000);
    expect(clock.monotonicMillis()).toBe(86_400_000);
  });

  it('can step wall time back without moving monotonic time', () => {
    const clock = frozenClock(10_000);
    clock.setWall(5_000);
    expect(clock.nowMillis()).toBe(5_000);
    expect(clock.monotonicMillis()).toBe(0);
  });

  it.each([-1, Number.NaN])('refuses to advance by %s', (ms) => {
    expect(() => {
      frozenClock().advance(ms);
    }).toThrow(RangeError);
  });
});
