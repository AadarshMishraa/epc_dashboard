import fc from 'fast-check';
import {
  ALLOW,
  authorize,
  checkEntitlement,
  classifyField,
  consumeQuota,
  coreError,
  createContext,
  deny,
  err,
  ok,
  parseCorrelationId,
  parseId,
  parseTenantId,
  requireTenant,
  Secret,
  type Actor,
  type AuditRecord,
  type AuditSink,
  type Authorizer,
  type ClassificationLookup,
  type CorrelationId,
  type EntitlementGate,
  type EraserRegistry,
  type EventEnvelope,
  type EventPublisher,
  type Id,
  type MessageSender,
  type QuotaProvider,
  type PlatformSecretsProvider,
  type TenantSecretsProvider,
  type SentMessage,
  type TenantContext,
  type TenantId,
} from '@gx/core';
import { describe, expect, it } from 'vitest';
import {
  auditSinkContract,
  authorizerContract,
  classificationLookupContract,
  ContractViolation,
  entitlementGateContract,
  eraserRegistryContract,
  eventPublisherContract,
  FakeAuditSink,
  FakeAuthorizer,
  FakeClassificationLookup,
  FakeEntitlementGate,
  FakeEraserRegistry,
  FakeEventPublisher,
  FakeMessageSender,
  FakeQuotaProvider,
  FakePlatformSecretsProvider,
  FakeTenantSecretsProvider,
  messageSenderContract,
  quotaProviderContract,
  secretsProviderContract,
  type ContractSuite,
} from './index.ts';

function runContract(suite: ContractSuite): void {
  describe(`${suite.port} contract on the fake`, () => {
    for (const contractCase of suite.cases) it(contractCase.name, contractCase.run);
  });
}

/** Names of the cases a (deliberately broken) adapter fails. Other errors are test bugs. */
async function failingCases(suite: ContractSuite): Promise<string[]> {
  const failed: string[] = [];
  for (const contractCase of suite.cases) {
    try {
      await contractCase.run();
    } catch (error) {
      if (!(error instanceof ContractViolation)) throw error;
      failed.push(contractCase.name);
    }
  }
  return failed;
}

runContract(authorizerContract((seed) => new FakeAuthorizer(seed)));
runContract(entitlementGateContract((seed) => new FakeEntitlementGate(seed)));
runContract(quotaProviderContract((seed) => new FakeQuotaProvider(seed)));
runContract(classificationLookupContract((seed) => new FakeClassificationLookup(seed)));
runContract(
  secretsProviderContract((seed) => ({
    tenant: new FakeTenantSecretsProvider(seed),
    platform: new FakePlatformSecretsProvider(seed),
  })),
);
runContract(
  auditSinkContract(() => {
    const sink = new FakeAuditSink();
    return { sink, read: (tenantId) => sink.records(tenantId) };
  }),
);
runContract(
  eventPublisherContract(() => {
    const publisher = new FakeEventPublisher();
    return { publisher, read: (tenantId) => publisher.published(tenantId) };
  }),
);
runContract(
  messageSenderContract(() => {
    const sender = new FakeMessageSender();
    return { sender, read: (tenantId) => sender.sent(tenantId) };
  }),
);
runContract(eraserRegistryContract(() => new FakeEraserRegistry()));

// ---------------------------------------------------------------- fixtures for fake-only tests

const clock = { nowMillis: () => 0, monotonicMillis: () => 0 };
const TENANT = parseTenantId('0190f3e2-7a1b-7c3d-8e4f-0000000000a1') as TenantId;
const OTHER_TENANT = parseTenantId('0190f3e2-7a1b-7c3d-8e4f-0000000000a2') as TenantId;
const USER = parseId('0190f3e2-7a1b-7c3d-8e4f-0000000000b1') as Id;
const correlationId = parseCorrelationId('fake-test') as CorrelationId;
const user: Actor = { kind: 'user', userId: USER };

let keyCounter = 0;
const nextKey = (): string => `fake-test-${String((keyCounter += 1))}`;

function tenantContext(tenantId: TenantId = TENANT, actor: Actor = user): TenantContext {
  const result = requireTenant(createContext({ tenantId, actor, correlationId, clock }));
  if (!result.ok) throw new Error('fixture context has no tenant');
  return result.value;
}

// ---------------------------------------------------------------- fakes fail closed

describe('fakes start empty and deny', () => {
  it('a new FakeAuthorizer denies', async () => {
    const decision = await authorize(new FakeAuthorizer(), tenantContext(), {
      permission: 'invoice.read',
    });
    expect(decision.allow).toBe(false);
  });

  it('a new FakeEntitlementGate denies', async () => {
    const decision = await checkEntitlement(new FakeEntitlementGate(), tenantContext(), 'module.x');
    expect(decision).toEqual({ allow: false, reason: 'UNKNOWN_KEY' });
  });

  it('a new FakeQuotaProvider grants nothing', async () => {
    const decision = await consumeQuota(new FakeQuotaProvider(), tenantContext(), {
      quota: 'api.calls',
      amount: 1,
      idempotencyKey: nextKey(),
    });
    expect(decision).toEqual({ allow: false, reason: 'UNKNOWN_QUOTA' });
  });

  it('a new FakeClassificationLookup classifies everything as secret', () => {
    const found = classifyField(new FakeClassificationLookup(), tenantContext(), {
      entity: 'a',
      field: 'b',
    });
    expect(found).toBe('secret');
  });
});

describe('FakeAuthorizer', () => {
  it('denies random permissions for random actors without an explicit grant (property)', async () => {
    const authorizer = new FakeAuthorizer({
      permissions: [{ name: 'invoice.read', mode: 'read' }],
      grants: [{ tenantId: TENANT, actor: user, permission: 'invoice.read' }],
    });
    await fc.assert(
      fc.asyncProperty(fc.string(), fc.boolean(), async (permission, defined) => {
        fc.pre(permission !== 'invoice.read');
        if (defined) authorizer.definePermission(permission, 'read');
        const decision = await authorize(authorizer, tenantContext(), { permission });
        expect(decision.allow).toBe(false);
      }),
    );
  });

  it('denies, with the cause, when set to throw', async () => {
    const authorizer = new FakeAuthorizer({
      permissions: [{ name: 'invoice.read', mode: 'read' }],
      grants: [{ tenantId: TENANT, actor: user, permission: 'invoice.read' }],
    });
    const failure = new Error('role cache unavailable');
    authorizer.failWith(failure);
    const decision = await authorize(authorizer, tenantContext(), { permission: 'invoice.read' });
    expect(decision).toEqual({ allow: false, reason: 'ERROR', cause: failure });
    authorizer.failWith(undefined);
    expect(await authorize(authorizer, tenantContext(), { permission: 'invoice.read' })).toEqual({
      allow: true,
    });
  });

  it('refuses a grant to an anonymous actor', () => {
    expect(() => {
      new FakeAuthorizer().grant(TENANT, { kind: 'anonymous' }, 'invoice.read');
    }).toThrow(TypeError);
  });
});

describe('FakeEntitlementGate and FakeQuotaProvider', () => {
  it('deny when set to throw', async () => {
    const gate = new FakeEntitlementGate({
      keys: ['module.x'],
      enabled: [{ tenantId: TENANT, key: 'module.x' }],
    });
    gate.failWith(new Error('down'));
    const quotas = new FakeQuotaProvider({
      limits: [{ tenantId: TENANT, quota: 'api.calls', limit: 5 }],
    });
    quotas.failWith(new Error('down'));
    expect((await checkEntitlement(gate, tenantContext(), 'module.x')).allow).toBe(false);
    expect(
      (
        await consumeQuota(quotas, tenantContext(), {
          quota: 'api.calls',
          amount: 1,
          idempotencyKey: nextKey(),
        })
      ).allow,
    ).toBe(false);
  });

  it('a quota limit must be a whole number of at least 0', () => {
    const quotas = new FakeQuotaProvider();
    for (const limit of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => {
        quotas.setLimit(TENANT, 'api.calls', limit);
      }).toThrow(RangeError);
    }
  });

  it('handles a limit of 0 and a limit at the largest safe integer', async () => {
    const quotas = new FakeQuotaProvider({
      limits: [
        { tenantId: TENANT, quota: 'none', limit: 0 },
        { tenantId: TENANT, quota: 'huge', limit: Number.MAX_SAFE_INTEGER },
      ],
    });
    expect(
      await consumeQuota(quotas, tenantContext(), {
        quota: 'none',
        amount: 1,
        idempotencyKey: nextKey(),
      }),
    ).toEqual({
      allow: false,
      reason: 'EXHAUSTED',
    });
    expect(
      await consumeQuota(quotas, tenantContext(), {
        quota: 'huge',
        amount: Number.MAX_SAFE_INTEGER,
        idempotencyKey: nextKey(),
      }),
    ).toEqual({
      allow: true,
      remaining: 0,
    });
    expect(
      await consumeQuota(quotas, tenantContext(), {
        quota: 'huge',
        amount: 1,
        idempotencyKey: nextKey(),
      }),
    ).toEqual({
      allow: false,
      reason: 'EXHAUSTED',
    });
  });

  it('reports what was used, per tenant', async () => {
    const quotas = new FakeQuotaProvider({
      limits: [{ tenantId: TENANT, quota: 'api.calls', limit: 5 }],
    });
    await consumeQuota(quotas, tenantContext(), {
      quota: 'api.calls',
      amount: 2,
      idempotencyKey: nextKey(),
    });
    expect(quotas.used(TENANT, 'api.calls')).toBe(2);
    expect(quotas.used(OTHER_TENANT, 'api.calls')).toBe(0);
  });
});

describe('FakeClassificationLookup', () => {
  it('is secret, with the cause reported, when set to throw', () => {
    const lookup = new FakeClassificationLookup({
      fields: [{ entity: 'customer', field: 'name', classification: 'personal' }],
    });
    lookup.failWith(new Error('cold cache'));
    const causes: unknown[] = [];
    const found = classifyField(
      lookup,
      tenantContext(),
      { entity: 'customer', field: 'name' },
      (c) => causes.push(c),
    );
    expect(found).toBe('secret');
    expect(causes).toHaveLength(1);
  });
});

describe('recording fakes', () => {
  const failure = coreError('DEPENDENCY_UNAVAILABLE', { detail: 'injected' });

  it('an injected audit failure reaches the caller and nothing is stored', async () => {
    const sink = new FakeAuditSink();
    sink.failNext(failure);
    const result = await sink.append(tenantContext(), {
      action: 'invoice.issue',
      outcome: 'succeeded',
    });
    expect(result).toEqual({ ok: false, error: failure });
    expect(sink.records(TENANT)).toEqual([]);
    const next = await sink.append(tenantContext(), {
      action: 'invoice.issue',
      outcome: 'succeeded',
    });
    expect(next.ok).toBe(true);
  });

  it('an injected publish or send failure reaches the caller and nothing is stored', async () => {
    const publisher = new FakeEventPublisher();
    publisher.failNext(failure);
    const published = await publisher.publish(tenantContext(), {
      name: 'invoice.issued',
      version: 1,
      payload: {},
    });
    const sender = new FakeMessageSender();
    sender.failNext(failure);
    const sent = await sender.send(tenantContext(), {
      channel: 'sms',
      to: '+919800001234',
      template: 'sign_in_code',
      purpose: 'authentication',
      consentRef: 'legal-basis:sign-in',
    });
    expect(published).toEqual({ ok: false, error: failure });
    expect(sent).toEqual({ ok: false, error: failure });
    expect(publisher.published(TENANT)).toEqual([]);
    expect(sender.sent(TENANT)).toEqual([]);
  });

  it('reading returns a snapshot the caller cannot change', async () => {
    const sink = new FakeAuditSink();
    await sink.append(tenantContext(), { action: 'invoice.issue', outcome: 'succeeded' });
    const records = sink.records(TENANT) as AuditRecord[];
    expect(() => records.pop()).toThrow(TypeError);
    expect(sink.records(TENANT)).toHaveLength(1);
  });

  it('keeps the eraser function it read at registration', async () => {
    const registry = new FakeEraserRegistry();
    const calls: string[] = [];
    const handler = {
      id: 'k8-files',
      erase: () => {
        calls.push('original');
        return Promise.resolve(ok({ status: 'erased' as const }));
      },
    };
    registry.register(handler);
    handler.erase = () => {
      calls.push('swapped');
      return Promise.resolve(ok({ status: 'erased' as const }));
    };
    await registry.erase(tenantContext(), { subjectId: USER });
    expect(calls).toEqual(['original']);
  });

  it('a handler that returns something other than a Result fails as INTERNAL', async () => {
    const registry = new FakeEraserRegistry();
    registry.register({ id: 'k8-files', erase: () => Promise.resolve(undefined as never) });
    const report = await registry.erase(tenantContext(), { subjectId: USER });
    expect(report.complete).toBe(false);
    expect(report.outcomes[0]).toMatchObject({ status: 'failed', error: { code: 'INTERNAL' } });
  });
});

// ---------------------------------------------------------------- the suites have teeth

describe('contract suites reject broken adapters', () => {
  it('Authorizer: allow-all fails', async () => {
    const allowAll: Authorizer = { check: () => Promise.resolve(ALLOW) };
    const failed = await failingCases(authorizerContract(() => allowAll));
    expect(failed).toContain('an empty seed denies every request');
  });

  it('Authorizer: ignoring the tenant fails the tenant case', async () => {
    const failed = await failingCases(
      authorizerContract((seed) => {
        const inner = new FakeAuthorizer(seed);
        const seededTenant = seed.grants[0]?.tenantId;
        // Looks grants up in the seeded tenant, whatever tenant the caller is in.
        const tenantBlind: Authorizer = {
          check: (context, request) =>
            inner.check(
              tenantContextFrom(context, context.actor, seededTenant ?? context.tenantId),
              request,
            ),
        };
        return tenantBlind;
      }),
    );
    expect(failed).toEqual(['a grant in one tenant does not allow in another']);
  });

  it('Authorizer: ignoring AI-client scopes fails the scope case', async () => {
    const failed = await failingCases(
      authorizerContract((seed) => {
        const inner = new FakeAuthorizer(seed);
        const scopeBlind: Authorizer = {
          check: (context, request) => {
            const actor = context.actor;
            const asUser =
              actor.kind === 'user' ? { kind: 'user' as const, userId: actor.userId } : actor;
            return inner.check(tenantContextFrom(context, asUser), request);
          },
        };
        return scopeBlind;
      }),
    );
    expect(failed).toContain('an AI client with read scope cannot write, even when the user can');
  });

  it('EntitlementGate: treating unknown keys as included fails', async () => {
    const lenient: EntitlementGate = { check: () => Promise.resolve(ALLOW) };
    const failed = await failingCases(entitlementGateContract(() => lenient));
    expect(failed).toContain('an empty seed denies every key');
    expect(failed).toContain('an unknown key is denied even when enabled for the tenant');
  });

  it('QuotaProvider: unlimited unknown quotas and unchecked amounts fail', async () => {
    const unlimited: QuotaProvider = {
      consume: () => Promise.resolve({ allow: true, remaining: Number.MAX_SAFE_INTEGER }),
    };
    const failed = await failingCases(quotaProviderContract(() => unlimited));
    expect(failed).toContain('an unknown quota is UNKNOWN_QUOTA, never unlimited');
    expect(failed).toContain(
      'the provider itself refuses NaN, zero, negative, fractional and unsafe amounts',
    );
    expect(failed).toContain('concurrent use never exceeds the limit');
  });

  it('QuotaProvider: a check-then-act race across an await fails the concurrency case', async () => {
    const failed = await failingCases(
      quotaProviderContract((seed) => {
        const used = new Map<string, number>();
        const racy: QuotaProvider = {
          consume: async (context, { quota, amount }) => {
            const limit = seed.limits.find(
              (l) => l.tenantId === context.tenantId && l.quota === quota,
            )?.limit;
            if (limit === undefined) return deny('UNKNOWN_QUOTA');
            if (!Number.isSafeInteger(amount) || amount < 1) return deny('INVALID_AMOUNT');
            const id = `${context.tenantId}/${quota}`;
            const before = used.get(id) ?? 0;
            await Promise.resolve(); // the read and the write are no longer one step
            if (before + amount > limit) return deny('EXHAUSTED');
            used.set(id, before + amount);
            return { allow: true, remaining: limit - before - amount };
          },
        };
        return racy;
      }),
    );
    expect(failed).toContain('concurrent use never exceeds the limit');
  });

  it('Authorizer: granting by "has any grant" instead of by permission fails', async () => {
    const failed = await failingCases(
      authorizerContract((seed) => {
        const inner = new FakeAuthorizer(seed);
        const permissionBlind: Authorizer = {
          check: async (context, request) => {
            const decision = await inner.check(context, request);
            if (decision.allow || decision.reason !== 'NO_GRANT') return decision;
            const holdsAny = seed.grants.some(
              (g) =>
                g.tenantId === context.tenantId &&
                JSON.stringify(g.actor) === JSON.stringify(context.actor),
            );
            return holdsAny ? ALLOW : decision;
          },
        };
        return permissionBlind;
      }),
    );
    expect(failed).toEqual([
      'a grant for one permission does not allow another: read granted, write asked',
    ]);
  });

  it('Authorizer: write scope implying read, or system actors bypassing grants, fails', async () => {
    const failed = await failingCases(
      authorizerContract((seed) => {
        const inner = new FakeAuthorizer(seed);
        const lax: Authorizer = {
          check: (context, request) => {
            const { actor } = context;
            if (actor.kind === 'system' || actor.kind === 'service_account')
              return Promise.resolve(ALLOW);
            if (actor.kind === 'user' && actor.via?.scopes.includes('write') === true) {
              const widened = {
                ...actor,
                via: { ...actor.via, scopes: ['read', 'write'] as const },
              };
              return inner.check(tenantContextFrom(context, widened), request);
            }
            return inner.check(context, request);
          },
        };
        return lax;
      }),
    );
    expect(failed).toContain('an AI client with only write scope cannot read: scopes are exact');
    expect(failed).toContain('service accounts and system processes need grants like anyone else');
  });

  it('EntitlementGate: ignoring which key is asked fails the two-key case', async () => {
    const failed = await failingCases(
      entitlementGateContract((seed) => {
        const known = new Set(seed.keys);
        const enabledTenants = new Set(seed.enabled.map((e) => e.tenantId));
        const keyBlind: EntitlementGate = {
          check: (context, key) =>
            Promise.resolve(
              !known.has(key)
                ? deny('UNKNOWN_KEY')
                : enabledTenants.has(context.tenantId)
                  ? ALLOW
                  : deny('NOT_ENTITLED'),
            ),
        };
        return keyBlind;
      }),
    );
    expect(failed).toEqual(['enabling one key does not enable another known key']);
  });

  it('QuotaProvider: one counter for every quota name fails the separation case', async () => {
    const failed = await failingCases(
      quotaProviderContract((seed) => {
        const merged = new FakeQuotaProvider({
          limits: seed.limits.map((l) => ({ ...l, quota: 'shared' })),
        });
        const nameBlind: QuotaProvider = {
          consume: (context, use) => merged.consume(context, { ...use, quota: 'shared' }),
        };
        return nameBlind;
      }),
    );
    expect(failed).toContain('quotas are counted separately');
  });

  it('QuotaProvider: one global key space across tenants fails the tenant case', async () => {
    const failed = await failingCases(
      quotaProviderContract((seed) => {
        const inner = new FakeQuotaProvider(seed);
        const owner = new Map<string, TenantId>();
        const globalKeys: QuotaProvider = {
          consume: (context, use) => {
            const first = owner.get(use.idempotencyKey);
            if (first !== undefined && first !== context.tenantId) {
              return Promise.resolve(deny('KEY_REUSED'));
            }
            owner.set(use.idempotencyKey, context.tenantId);
            return inner.consume(context, use);
          },
        };
        return globalKeys;
      }),
    );
    expect(failed).toEqual(['the same key in two tenants is two separate uses']);
  });

  it('QuotaProvider: ignoring idempotency keys fails the replay cases', async () => {
    const failed = await failingCases(
      quotaProviderContract((seed) => {
        const inner = new FakeQuotaProvider(seed);
        const forgetful: QuotaProvider = {
          consume: (context, use) => inner.consume(context, { ...use, idempotencyKey: nextKey() }),
        };
        return forgetful;
      }),
    );
    expect(failed).toContain(
      'a replayed idempotency key returns the first grant and consumes nothing more',
    );
    expect(failed).toContain(
      'reusing a key for a different use is KEY_REUSED and consumes nothing',
    );
  });

  it('ClassificationLookup: letting a tenant override win fails the downgrade case', async () => {
    const failed = await failingCases(
      classificationLookupContract((seed) => {
        const lookup: ClassificationLookup = {
          classify: (context, field) => {
            const match = (tenant: boolean) =>
              seed.fields.find(
                (f) =>
                  f.entity === field.entity &&
                  f.field === field.field &&
                  (tenant
                    ? f.tenantId === context.tenantId && f.tenantId !== undefined
                    : f.tenantId === undefined),
              );
            return (match(true) ?? match(false))?.classification ?? 'secret';
          },
        };
        return lookup;
      }),
    );
    expect(failed).toEqual(['a tenant cannot lower the class of a declared field']);
  });

  it('EraserRegistry: a silent retention counted as complete fails', async () => {
    const failed = await failingCases(
      eraserRegistryContract(() => {
        const inner = new FakeEraserRegistry();
        const lax: EraserRegistry = {
          register: (handler) => inner.register(handler),
          erase: async (context, subject) => {
            const report = await inner.erase(context, subject);
            return { complete: report.outcomes.length > 0, outcomes: report.outcomes };
          },
        };
        return lax;
      }),
    );
    expect(failed).toContain('a retention without a basis is a failure, never silent');
  });

  it('ClassificationLookup: unknown as public fails', async () => {
    const lenient: ClassificationLookup = { classify: () => 'public' };
    const failed = await failingCases(classificationLookupContract(() => lenient));
    expect(failed).toContain('an unknown field is secret');
  });

  it('SecretsProvider: ignoring the tenant, or returning a plain string, fails', async () => {
    const tenantBlind = await failingCases(
      secretsProviderContract((seed) => {
        const tenant: TenantSecretsProvider = {
          get: (_context, name) => {
            const found = seed.tenantSecrets.find((s) => s.name === name);
            return Promise.resolve(
              found ? ok(new Secret(found.value)) : err(coreError('NOT_FOUND')),
            );
          },
        };
        return { tenant, platform: new FakePlatformSecretsProvider(seed) };
      }),
    );
    const plainString = await failingCases(
      secretsProviderContract((seed) => {
        const tenant: TenantSecretsProvider = {
          get: () => Promise.resolve(ok(seed.tenantSecrets[0]?.value as unknown as Secret)),
        };
        const platform: PlatformSecretsProvider = new FakePlatformSecretsProvider(seed);
        return { tenant, platform };
      }),
    );
    expect(tenantBlind).toContain('another tenant gets NOT_FOUND, identical to a missing secret');
    expect(plainString).toContain('a tenant reads its own secret as a Secret');
  });

  it('AuditSink: a mutable record, or a sink that acknowledges without storing, fails', async () => {
    const mutable = await failingCases(
      auditSinkContract(() => {
        const stored: AuditRecord[] = [];
        const sink: AuditSink = {
          append: (context, entry) => {
            const record = {
              ...entry,
              id: USER,
              tenantId: context.tenantId,
              actor: context.actor,
              correlationId: context.correlationId,
              occurredAtMillis: context.clock.nowMillis(),
            };
            if (!/^[a-z_]+\.[a-z_]+$/.test(entry.action))
              return Promise.resolve(err(coreError('VALIDATION_FAILED')));
            stored.push(record);
            return Promise.resolve(ok(record));
          },
        };
        return { sink, read: () => stored };
      }),
    );
    const silent = await failingCases(
      auditSinkContract(() => {
        const inner = new FakeAuditSink();
        return { sink: inner, read: () => [] };
      }),
    );
    expect(mutable).toContain(
      'the returned record is frozen, so it cannot be changed after the fact',
    );
    expect(silent).toContain(
      'append stores a record with tenant, actor, correlation id and time from the context',
    );
  });

  it('EventPublisher: storing the caller’s payload object fails the copy case', async () => {
    const failed = await failingCases(
      eventPublisherContract(() => {
        const inner = new FakeEventPublisher();
        const live: EventEnvelope[] = [];
        const publisher: EventPublisher = {
          publish: async (context, event) => {
            const result = await inner.publish(context, event);
            if (result.ok) live.push({ ...result.value, payload: event.payload as never });
            return result;
          },
        };
        return { publisher, read: (tenantId) => live.filter((e) => e.tenantId === tenantId) };
      }),
    );
    expect(failed).toEqual(['the payload is copied and frozen, so later changes are not seen']);
  });

  it('MessageSender: no consent check and a stored full address fail', async () => {
    const failed = await failingCases(
      messageSenderContract(() => {
        const stored: SentMessage[] = [];
        const sender: MessageSender = {
          send: (context, message) => {
            const record = {
              ...message,
              id: USER,
              tenantId: context.tenantId,
              correlationId: context.correlationId,
              recipient: message.to,
            };
            stored.push(record);
            return Promise.resolve(ok(record));
          },
        };
        return { sender, read: (tenantId) => stored.filter((m) => m.tenantId === tenantId) };
      }),
    );
    expect(failed).toContain('a message without a consent reference is refused and not sent');
    expect(failed).toContain(
      'the send record keeps the purpose, consent and a masked recipient only',
    );
  });

  it('EraserRegistry: overwriting duplicates and calling an empty erase complete fails', async () => {
    const failed = await failingCases(
      eraserRegistryContract(() => {
        const handlers = new Map<string, Parameters<EraserRegistry['register']>[0]>();
        const lax: EraserRegistry = {
          register: (handler) => {
            handlers.set(handler.id, handler);
            return ok(undefined);
          },
          erase: async (context, subject) => {
            for (const handler of handlers.values()) {
              await handler.erase(context, subject).catch(() => undefined);
            }
            return { complete: true, outcomes: [] };
          },
        };
        return lax;
      }),
    );
    expect(failed).toContain('an erase with no handlers is not complete');
    expect(failed).toContain('a duplicate id is refused and the first handler stays');
  });
});

function tenantContextFrom(
  context: TenantContext,
  actor: Actor,
  tenantId: TenantId = context.tenantId,
): TenantContext {
  const result = requireTenant(
    createContext({ tenantId, actor, correlationId: context.correlationId, clock: context.clock }),
  );
  if (!result.ok) throw new Error('context lost its tenant');
  return result.value;
}
