import {
  grantSubject,
  type Authorizer,
  type ClassificationLookup,
  type EntitlementGate,
  type QuotaProvider,
  type SecretsProvider,
} from '@gx/core';
import { format, inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { tenantContext, testId, testTenant, viaAiClient } from '../context.ts';
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
const OPERATOR = testId(9);
const SERVICE = testId(11);
const resource = { type: 'invoice' } as const;
const user = (id = USER) => grantSubject({ kind: 'user', userId: id }) ?? '';

/** Every Authorizer (fake or K2's) must deny by default and respect actor ceilings. */
export function authorizerContract(
  name: string,
  make: ContractFactory<AuthorizerSeed, Authorizer>,
): void {
  describe(`${name}: Authorizer contract`, () => {
    const operator = {
      kind: 'operator',
      operatorId: OPERATOR,
      supportSessionId: testId(10),
    } as const;
    const seed: AuthorizerSeed = {
      permissions: { 'invoice.read': 'read', 'invoice.issue': 'write' },
      grants: [
        { tenantId: A, subject: user(), permission: 'invoice.read' },
        { tenantId: A, subject: user(), permission: 'invoice.issue' },
        { tenantId: A, subject: grantSubject(operator) ?? '', permission: 'invoice.read' },
        {
          tenantId: A,
          subject: grantSubject({ kind: 'service_account', serviceAccountId: SERVICE }) ?? '',
          permission: 'invoice.read',
        },
        {
          tenantId: A,
          subject: grantSubject({ kind: 'system', process: 'jobs' }) ?? '',
          permission: 'invoice.read',
        },
      ],
    };
    const can = async (actor: Parameters<typeof tenantContext>[0], permission = 'invoice.read') =>
      (await make(seed)).can(tenantContext(actor), permission, resource);

    it('denies everything with an empty seed', async () => {
      expect(await (await make({})).can(tenantContext(), 'invoice.read', resource)).toEqual({
        allow: false,
        reason: 'UNKNOWN_PERMISSION',
      });
    });

    it('denies an unknown permission even when a grant names it', async () => {
      const authorizer = await make({
        grants: [{ tenantId: A, subject: user(), permission: 'invoice.read' }],
      });
      expect(await authorizer.can(tenantContext(), 'invoice.read', resource)).toEqual({
        allow: false,
        reason: 'UNKNOWN_PERMISSION',
      });
    });

    it('allows a granted permission and denies one without a grant', async () => {
      expect(await can({})).toEqual({ allow: true });
      expect(await can({ actor: { kind: 'user', userId: testId(2) } })).toEqual({
        allow: false,
        reason: 'NO_GRANT',
      });
    });

    it('never carries a grant into another tenant', async () => {
      expect(await can({ tenantId: B })).toEqual({ allow: false, reason: 'NO_GRANT' });
    });

    it('denies an AI client a write without the write scope, even when the user may write', async () => {
      expect(await can({ actor: viaAiClient(USER, ['read']) }, 'invoice.issue')).toEqual({
        allow: false,
        reason: 'SCOPE_EXCEEDED',
      });
      expect(await can({ actor: viaAiClient(USER, ['read']) })).toEqual({ allow: true });
      expect(await can({ actor: viaAiClient(USER, ['read', 'write']) }, 'invoice.issue')).toEqual({
        allow: true,
      });
    });

    it('keeps a support operator read-only, and needs a grant even to read', async () => {
      expect(await can({ actor: operator }, 'invoice.issue')).toEqual({
        allow: false,
        reason: 'SUPPORT_READ_ONLY',
      });
      expect(await can({ actor: operator })).toEqual({ allow: true });
      const ungranted = {
        kind: 'operator',
        operatorId: testId(12),
        supportSessionId: testId(10),
      } as const;
      expect(await can({ actor: ungranted })).toEqual({ allow: false, reason: 'NO_GRANT' });
    });

    it("never applies one actor kind's grant to another kind with the same id", async () => {
      expect(await can({ actor: { kind: 'user', userId: OPERATOR } })).toEqual({
        allow: false,
        reason: 'NO_GRANT',
      });
      expect(await can({ actor: { kind: 'service_account', serviceAccountId: USER } })).toEqual({
        allow: false,
        reason: 'NO_GRANT',
      });
    });

    it('checks service accounts and system processes by their own grants', async () => {
      expect(await can({ actor: { kind: 'service_account', serviceAccountId: SERVICE } })).toEqual({
        allow: true,
      });
      expect(await can({ actor: { kind: 'system', process: 'jobs' } })).toEqual({ allow: true });
      expect(await can({ actor: { kind: 'system', process: 'other' } })).toEqual({
        allow: false,
        reason: 'NO_GRANT',
      });
    });

    it('denies an anonymous caller', async () => {
      expect(await can({ actor: { kind: 'anonymous' } })).toEqual({
        allow: false,
        reason: 'NO_GRANT',
      });
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

/** Two or more instances over one store, as two app servers would share one database. */
export interface QuotaHarness {
  readonly instance: () => QuotaProvider;
}

export function quotaProviderContract(
  name: string,
  make: ContractFactory<QuotaSeed, QuotaHarness>,
): void {
  describe(`${name}: QuotaProvider contract`, () => {
    const seed: QuotaSeed = {
      limits: [
        { tenantId: A, quota: 'records', limit: 5 },
        { tenantId: B, quota: 'records', limit: 5 },
      ],
    };
    const one = async (s: QuotaSeed = seed) => (await make(s)).instance();

    it('treats an unknown quota as exhausted, never unlimited', async () => {
      expect(await (await one({})).consume(tenantContext(), 'records', 1)).toEqual({
        granted: false,
        reason: 'UNKNOWN_QUOTA',
      });
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects the amount %s',
      async (amount) => {
        expect(await (await one()).consume(tenantContext(), 'records', amount)).toEqual({
          granted: false,
          reason: 'INVALID_AMOUNT',
        });
      },
    );

    it('grants within the limit and refuses past it without partial consumption', async () => {
      const quotas = await one();
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

    it('never overdraws under 200 concurrent callers spread over two instances', async () => {
      const harness = await make(seed);
      const first = harness.instance();
      const second = harness.instance();
      const calls = Array.from({ length: 200 }, (_, i) =>
        (i % 2 === 0 ? first : second).consume(tenantContext(), 'records', 1),
      );
      const results = await Promise.all(calls);
      expect(results.filter((r) => r.granted)).toHaveLength(5);
    });

    it("does not spend one tenant's quota for another", async () => {
      const quotas = await one();
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
      const printed = [
        String(secret),
        JSON.stringify({ secret }),
        inspect(secret),
        inspect({ nested: { secret } }),
        inspect(secret, { customInspect: false }),
        format('%o %O %s %j', secret, secret, secret, { secret }),
      ];
      for (const text of printed) expect(text).not.toContain('platform-pepper-value');
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

    it('never falls back between platform and tenant secrets', async () => {
      const secrets = await make(seed);
      expect((await secrets.platform('whatsapp_key')).ok).toBe(false);
      expect((await secrets.forTenant(tenantContext(), 'pepper')).ok).toBe(false);
    });
  });
}
