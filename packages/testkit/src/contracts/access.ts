import type {
  Authorizer,
  ClassificationLookup,
  EntitlementGate,
  QuotaProvider,
  SecretsProvider,
} from '@gx/core';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { tenantContext, testId, testTenant } from '../context.ts';
import type {
  AuthorizerSeed,
  ClassificationSeed,
  EntitlementSeed,
  QuotaSeed,
} from '../fakes/access.ts';
import type { SecretsSeed } from '../fakes/secrets.ts';

/** Builds the port under test from a seed; real adapters translate the seed into their store. */
export type ContractFactory<S, T> = (seed: S) => T | Promise<T>;
const A = testTenant(1);
const B = testTenant(2);
const USER = testId(1);
const resource = { type: 'invoice' } as const;

/** Every Authorizer (fake or K2's) must deny by default and respect actor ceilings. */
export function authorizerContract(
  name: string,
  make: ContractFactory<AuthorizerSeed, Authorizer>,
): void {
  describe(`${name}: Authorizer contract`, () => {
    const seed: AuthorizerSeed = {
      permissions: { 'invoice.read': 'read', 'invoice.issue': 'write' },
      grants: [
        { tenantId: A, subject: USER, permission: 'invoice.read' },
        { tenantId: A, subject: USER, permission: 'invoice.issue' },
        { tenantId: A, subject: testId(9), permission: 'invoice.read' },
      ],
    };

    it('denies everything with an empty seed', async () => {
      const authorizer = await make({});
      expect(await authorizer.can(tenantContext(), 'invoice.read', resource)).toEqual({
        allow: false,
        reason: 'UNKNOWN_PERMISSION',
      });
    });

    it('denies an unknown permission even when a grant names it', async () => {
      const authorizer = await make({
        grants: [{ tenantId: A, subject: USER, permission: 'invoice.read' }],
      });
      expect(await authorizer.can(tenantContext(), 'invoice.read', resource)).toEqual({
        allow: false,
        reason: 'UNKNOWN_PERMISSION',
      });
    });

    it('allows a granted permission and denies one without a grant', async () => {
      const authorizer = await make(seed);
      expect(await authorizer.can(tenantContext(), 'invoice.read', resource)).toEqual({
        allow: true,
      });
      const other = tenantContext({ actor: { kind: 'user', userId: testId(2) } });
      expect(await authorizer.can(other, 'invoice.read', resource)).toEqual({
        allow: false,
        reason: 'NO_GRANT',
      });
    });

    it('never carries a grant into another tenant', async () => {
      const authorizer = await make(seed);
      expect(
        await authorizer.can(tenantContext({ tenantId: B }), 'invoice.read', resource),
      ).toEqual({ allow: false, reason: 'NO_GRANT' });
    });

    it('denies an AI client a write without the write scope, even when the user may write', async () => {
      const authorizer = await make(seed);
      const viaRead = tenantContext({
        actor: {
          kind: 'user',
          userId: USER,
          via: { kind: 'ai_client', clientId: 'claude' as never, scopes: ['read'] },
        },
      });
      expect(await authorizer.can(viaRead, 'invoice.issue', resource)).toEqual({
        allow: false,
        reason: 'SCOPE_EXCEEDED',
      });
      expect(await authorizer.can(viaRead, 'invoice.read', resource)).toEqual({ allow: true });
    });

    it('keeps a support operator read-only', async () => {
      const authorizer = await make(seed);
      const operator = tenantContext({
        actor: { kind: 'operator', operatorId: testId(9), supportSessionId: testId(10) },
      });
      expect(await authorizer.can(operator, 'invoice.issue', resource)).toEqual({
        allow: false,
        reason: 'SUPPORT_READ_ONLY',
      });
      expect(await authorizer.can(operator, 'invoice.read', resource)).toEqual({ allow: true });
    });

    it('denies an anonymous caller', async () => {
      const authorizer = await make(seed);
      expect(
        await authorizer.can(
          tenantContext({ actor: { kind: 'anonymous' } }),
          'invoice.read',
          resource,
        ),
      ).toEqual({ allow: false, reason: 'NO_GRANT' });
    });
  });
}

export function entitlementGateContract(
  name: string,
  make: ContractFactory<EntitlementSeed, EntitlementGate>,
): void {
  describe(`${name}: EntitlementGate contract`, () => {
    const seed: EntitlementSeed = {
      keys: ['files', 'workflow'],
      enabled: [{ tenantId: A, key: 'files' }],
    };

    it('denies an unknown key, never enables it', async () => {
      expect(await (await make({})).check(tenantContext(), 'files')).toEqual({
        enabled: false,
        reason: 'UNKNOWN_KEY',
      });
    });

    it('enables only what the tenant has, and not for another tenant', async () => {
      const gate = await make(seed);
      expect(await gate.check(tenantContext(), 'files')).toEqual({ enabled: true });
      expect(await gate.check(tenantContext(), 'workflow')).toEqual({
        enabled: false,
        reason: 'NOT_ENABLED',
      });
      expect(await gate.check(tenantContext({ tenantId: B }), 'files')).toEqual({
        enabled: false,
        reason: 'NOT_ENABLED',
      });
    });
  });
}

export function quotaProviderContract(
  name: string,
  make: ContractFactory<QuotaSeed, QuotaProvider>,
): void {
  describe(`${name}: QuotaProvider contract`, () => {
    const seed: QuotaSeed = {
      limits: [
        { tenantId: A, quota: 'records', limit: 5 },
        { tenantId: B, quota: 'records', limit: 5 },
      ],
    };

    it('treats an unknown quota as exhausted, never unlimited', async () => {
      expect(await (await make({})).consume(tenantContext(), 'records', 1)).toEqual({
        granted: false,
        reason: 'UNKNOWN_QUOTA',
      });
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects the amount %s',
      async (amount) => {
        expect(await (await make(seed)).consume(tenantContext(), 'records', amount)).toEqual({
          granted: false,
          reason: 'INVALID_AMOUNT',
        });
      },
    );

    it('grants within the limit and refuses past it without partial consumption', async () => {
      const quotas = await make(seed);
      expect(await quotas.consume(tenantContext(), 'records', 4)).toEqual({
        granted: true,
        remaining: 1,
      });
      expect(await quotas.consume(tenantContext(), 'records', 2)).toMatchObject({
        granted: false,
        reason: 'EXHAUSTED',
      });
      expect(await quotas.consume(tenantContext(), 'records', 1)).toEqual({
        granted: true,
        remaining: 0,
      });
    });

    it('never overdraws under 20 concurrent callers', async () => {
      const quotas = await make(seed);
      const results = await Promise.all(
        Array.from({ length: 20 }, () => quotas.consume(tenantContext(), 'records', 1)),
      );
      expect(results.filter((r) => r.granted)).toHaveLength(5);
    });

    it("does not spend one tenant's quota for another", async () => {
      const quotas = await make(seed);
      await quotas.consume(tenantContext(), 'records', 5);
      expect(await quotas.consume(tenantContext({ tenantId: B }), 'records', 5)).toEqual({
        granted: true,
        remaining: 0,
      });
    });
  });
}

export function classificationLookupContract(
  name: string,
  make: ContractFactory<ClassificationSeed, ClassificationLookup>,
): void {
  describe(`${name}: ClassificationLookup contract`, () => {
    it('returns the declared class', async () => {
      const lookup = await make({
        fields: [{ entity: 'party', field: 'phone', class: 'personal' }],
      });
      expect(lookup.classify('party', 'phone')).toBe('personal');
    });

    it('treats an unknown field or entity as secret, never public', async () => {
      const lookup = await make({
        fields: [{ entity: 'party', field: 'name', class: 'personal' }],
      });
      expect(lookup.classify('party', 'phone')).toBe('secret');
      expect(lookup.classify('unknown', 'name')).toBe('secret');
      expect(lookup.classify('Party', 'name')).toBe('secret');
    });
  });
}

export function secretsProviderContract(
  name: string,
  make: ContractFactory<SecretsSeed, SecretsProvider>,
): void {
  describe(`${name}: SecretsProvider contract`, () => {
    const seed: SecretsSeed = {
      platform: { pepper: 'platform-pepper-value' },
      tenant: [{ tenantId: A, name: 'whatsapp_key', value: 'tenant-a-key-value' }],
    };

    it('returns a seeded secret that only reveal() exposes', async () => {
      const result = await (await make(seed)).platform('pepper');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const secret = result.value;
      expect(secret.reveal()).toBe('platform-pepper-value');
      for (const printed of [
        String(secret),
        String(secret),
        JSON.stringify({ secret }),
        inspect(secret),
        inspect({ nested: { secret } }),
      ]) {
        expect(printed).not.toContain('platform-pepper-value');
      }
      expect(JSON.stringify({ secret })).toBe('{"secret":"[secret]"}');
    });

    it("gives another tenant's secret the same NOT_FOUND as a missing one", async () => {
      const secrets = await make(seed);
      const otherTenant = await secrets.forTenant(tenantContext({ tenantId: B }), 'whatsapp_key');
      const missing = await secrets.forTenant(tenantContext({ tenantId: B }), 'no_such_key');
      expect(otherTenant).toEqual(missing);
      expect(!otherTenant.ok && otherTenant.error.code).toBe('NOT_FOUND');
      const own = await secrets.forTenant(tenantContext(), 'whatsapp_key');
      expect(own.ok && own.value.reveal()).toBe('tenant-a-key-value');
    });

    it('does not return a tenant secret as a platform secret', async () => {
      expect((await (await make(seed)).platform('whatsapp_key')).ok).toBe(false);
    });
  });
}
