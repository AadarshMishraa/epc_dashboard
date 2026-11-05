import {
  authorize,
  checkEntitlement,
  classifyField,
  consumeQuota,
  CLASSIFICATIONS,
  isAllowed,
  parseAiClientId,
  type Actor,
  type AiClientId,
  type AiClientScope,
  type Authorizer,
  type Classification,
  type ClassificationLookup,
  type EntitlementGate,
  type PermissionMode,
  type QuotaProvider,
  type QuotaUse,
  type TenantId,
} from '@gx/core';
import {
  check,
  contextFor,
  contextWithoutTenant,
  suite,
  TENANT_A,
  TENANT_B,
  USER_1,
  USER_2,
  user1,
  user2,
  type AdapterFactory,
  sameJson,
  type ContractSuite,
} from '../contract.ts';

const reasonOf = (decision: { readonly allow: boolean; readonly reason?: string }): string =>
  decision.allow ? 'allow' : (decision.reason ?? 'missing reason');

// ---------------------------------------------------------------- Authorizer

export interface AuthorizerSeed {
  readonly permissions: readonly { readonly name: string; readonly mode: PermissionMode }[];
  readonly grants: readonly {
    readonly tenantId: TenantId;
    readonly actor: Actor;
    readonly permission: string;
  }[];
}

const READ = 'invoice.read';
const WRITE = 'invoice.issue';
const BOTH: AuthorizerSeed['permissions'] = [
  { name: READ, mode: 'read' },
  { name: WRITE, mode: 'write' },
];
const clientId = parseAiClientId('contract-client') as AiClientId;
const viaClient = (scopes: readonly AiClientScope[]): Actor => ({
  kind: 'user',
  userId: USER_1,
  via: { kind: 'ai_client', clientId, scopes },
});
const operator: Actor = { kind: 'operator', operatorId: USER_1, supportSessionId: USER_1 };
const serviceAccount: Actor = { kind: 'service_account', serviceAccountId: USER_2 };
const systemProcess: Actor = { kind: 'system', process: 'contract-scheduler' };
const grantsFor = (actor: Actor, tenantId: TenantId = TENANT_A): AuthorizerSeed['grants'] => [
  { tenantId, actor, permission: READ },
  { tenantId, actor, permission: WRITE },
];

/**
 * Deny by default (threat model K0-T14): an empty seed, an unknown permission, another
 * tenant's grant, another actor's grant, an AI client beyond its scope and an operator
 * writing are all denied with a reason.
 */
export function authorizerContract(
  create: AdapterFactory<AuthorizerSeed, Authorizer>,
): ContractSuite {
  const decide = async (
    seed: AuthorizerSeed,
    permission: string,
    actor: Actor = user1,
    tenantId: TenantId = TENANT_A,
  ): Promise<string> =>
    reasonOf(await authorize(await create(seed), contextFor(tenantId, actor), { permission }));

  return suite('Authorizer', [
    [
      'an empty seed denies every request',
      async () => {
        const reason = await decide({ permissions: [], grants: [] }, READ);
        check(reason === 'UNKNOWN_PERMISSION', `expected UNKNOWN_PERMISSION, got ${reason}`);
      },
    ],
    [
      'a known permission with no grant is NO_GRANT',
      async () => {
        const reason = await decide({ permissions: BOTH, grants: [] }, READ);
        check(reason === 'NO_GRANT', `expected NO_GRANT, got ${reason}`);
      },
    ],
    [
      'an unknown permission is denied even when it was granted',
      async () => {
        const seed = {
          permissions: [],
          grants: [{ tenantId: TENANT_A, actor: user1, permission: READ }],
        };
        const reason = await decide(seed, READ);
        check(reason === 'UNKNOWN_PERMISSION', `expected UNKNOWN_PERMISSION, got ${reason}`);
      },
    ],
    [
      'an explicit grant allows',
      async () => {
        const reason = await decide({ permissions: BOTH, grants: grantsFor(user1) }, READ);
        check(reason === 'allow', `expected allow, got ${reason}`);
      },
    ],
    [
      'a grant in one tenant does not allow in another',
      async () => {
        const reason = await decide(
          { permissions: BOTH, grants: grantsFor(user1) },
          READ,
          user1,
          TENANT_B,
        );
        check(reason === 'NO_GRANT', `expected NO_GRANT in the other tenant, got ${reason}`);
      },
    ],
    [
      'one user’s grant does not allow another user',
      async () => {
        const reason = await decide({ permissions: BOTH, grants: grantsFor(user1) }, READ, user2);
        check(reason === 'NO_GRANT', `expected NO_GRANT for the other user, got ${reason}`);
      },
    ],
    [
      'an anonymous caller is UNAUTHENTICATED',
      async () => {
        const reason = await decide({ permissions: BOTH, grants: [] }, READ, { kind: 'anonymous' });
        check(reason === 'UNAUTHENTICATED', `expected UNAUTHENTICATED, got ${reason}`);
      },
    ],
    [
      'an AI client with read scope cannot write, even when the user can',
      async () => {
        const reason = await decide(
          { permissions: BOTH, grants: grantsFor(user1) },
          WRITE,
          viaClient(['read']),
        );
        check(reason === 'SCOPE_EXCEEDED', `expected SCOPE_EXCEEDED, got ${reason}`);
      },
    ],
    [
      'an AI client with read scope reads what the user can read',
      async () => {
        const reason = await decide(
          { permissions: BOTH, grants: grantsFor(user1) },
          READ,
          viaClient(['read']),
        );
        check(reason === 'allow', `expected allow, got ${reason}`);
      },
    ],
    [
      'an AI client never exceeds the user: no user grant, no access',
      async () => {
        const reason = await decide(
          { permissions: BOTH, grants: [] },
          READ,
          viaClient(['read', 'write']),
        );
        check(reason === 'NO_GRANT', `expected NO_GRANT, got ${reason}`);
      },
    ],
    [
      'a support operator cannot write, even with a grant',
      async () => {
        const reason = await decide(
          { permissions: BOTH, grants: grantsFor(operator) },
          WRITE,
          operator,
        );
        check(reason === 'OPERATOR_READ_ONLY', `expected OPERATOR_READ_ONLY, got ${reason}`);
      },
    ],
    [
      'a support operator reads only with a grant',
      async () => {
        const without = await decide({ permissions: BOTH, grants: [] }, READ, operator);
        const granted = await decide(
          { permissions: BOTH, grants: grantsFor(operator) },
          READ,
          operator,
        );
        check(without === 'NO_GRANT', `expected NO_GRANT without a grant, got ${without}`);
        check(granted === 'allow', `expected allow with a grant, got ${granted}`);
      },
    ],
    [
      'a grant for one permission does not allow another: read granted, write asked',
      async () => {
        const seed = {
          permissions: BOTH,
          grants: [{ tenantId: TENANT_A, actor: user1, permission: READ }],
        };
        const write = await decide(seed, WRITE);
        const read = await decide(seed, READ);
        check(write === 'NO_GRANT', `expected NO_GRANT for the ungranted permission, got ${write}`);
        check(read === 'allow', `expected allow for the granted permission, got ${read}`);
      },
    ],
    [
      'an AI client with only write scope cannot read: scopes are exact',
      async () => {
        const reason = await decide(
          { permissions: BOTH, grants: grantsFor(user1) },
          READ,
          viaClient(['write']),
        );
        check(reason === 'SCOPE_EXCEEDED', `expected SCOPE_EXCEEDED, got ${reason}`);
      },
    ],
    [
      'an AI client with no scopes can do nothing',
      async () => {
        const reason = await decide(
          { permissions: BOTH, grants: grantsFor(user1) },
          READ,
          viaClient([]),
        );
        check(reason === 'SCOPE_EXCEEDED', `expected SCOPE_EXCEEDED, got ${reason}`);
      },
    ],
    [
      'service accounts and system processes need grants like anyone else',
      async () => {
        for (const actor of [serviceAccount, systemProcess]) {
          const without = await decide({ permissions: BOTH, grants: [] }, WRITE, actor);
          const granted = await decide(
            { permissions: BOTH, grants: grantsFor(actor) },
            WRITE,
            actor,
          );
          check(
            without === 'NO_GRANT',
            `expected NO_GRANT for ${actor.kind} without a grant, got ${without}`,
          );
          check(
            granted === 'allow',
            `expected allow for ${actor.kind} with a grant, got ${granted}`,
          );
        }
      },
    ],
    [
      'a denial is a tagged value, never a boolean or undefined',
      async () => {
        const authorizer = await create({ permissions: BOTH, grants: [] });
        const raw: unknown = await authorizer.check(contextFor(TENANT_A), { permission: READ });
        check(typeof raw === 'object' && raw !== null, 'check must return an object');
        check(!isAllowed(raw), 'an ungranted permission must not be allowed');
        const reason = (raw as { reason?: unknown }).reason;
        check(typeof reason === 'string' && reason !== '', 'a denial must carry a reason');
      },
    ],
  ]);
}

// ---------------------------------------------------------------- EntitlementGate

export interface EntitlementSeed {
  readonly keys: readonly string[];
  readonly enabled: readonly { readonly tenantId: TenantId; readonly key: string }[];
}

const KEY = 'module.invoicing';
const OTHER_KEY = 'module.payroll';

/** Unknown keys are denied, never treated as included; enablement is per tenant. */
export function entitlementGateContract(
  create: AdapterFactory<EntitlementSeed, EntitlementGate>,
): ContractSuite {
  const decide = async (
    seed: EntitlementSeed,
    key: string,
    tenantId: TenantId = TENANT_A,
  ): Promise<string> =>
    reasonOf(await checkEntitlement(await create(seed), contextFor(tenantId), key));

  return suite('EntitlementGate', [
    [
      'an empty seed denies every key',
      async () => {
        const reason = await decide({ keys: [], enabled: [] }, KEY);
        check(reason === 'UNKNOWN_KEY', `expected UNKNOWN_KEY, got ${reason}`);
      },
    ],
    [
      'an unknown key is denied even when enabled for the tenant',
      async () => {
        const reason = await decide({ keys: [], enabled: [{ tenantId: TENANT_A, key: KEY }] }, KEY);
        check(reason === 'UNKNOWN_KEY', `expected UNKNOWN_KEY, got ${reason}`);
      },
    ],
    [
      'a known key that is not enabled is NOT_ENTITLED',
      async () => {
        const reason = await decide({ keys: [KEY], enabled: [] }, KEY);
        check(reason === 'NOT_ENTITLED', `expected NOT_ENTITLED, got ${reason}`);
      },
    ],
    [
      'an enabled key allows',
      async () => {
        const reason = await decide(
          { keys: [KEY], enabled: [{ tenantId: TENANT_A, key: KEY }] },
          KEY,
        );
        check(reason === 'allow', `expected allow, got ${reason}`);
      },
    ],
    [
      'enabling one key does not enable another known key',
      async () => {
        const seed = { keys: [KEY, OTHER_KEY], enabled: [{ tenantId: TENANT_A, key: KEY }] };
        const other = await decide(seed, OTHER_KEY);
        check(other === 'NOT_ENTITLED', `expected NOT_ENTITLED for the other key, got ${other}`);
      },
    ],
    [
      'a key enabled for one tenant is not enabled for another',
      async () => {
        const reason = await decide(
          { keys: [KEY], enabled: [{ tenantId: TENANT_A, key: KEY }] },
          KEY,
          TENANT_B,
        );
        check(reason === 'NOT_ENTITLED', `expected NOT_ENTITLED, got ${reason}`);
      },
    ],
  ]);
}

// ---------------------------------------------------------------- QuotaProvider

export interface QuotaSeed {
  readonly limits: readonly {
    readonly tenantId: TenantId;
    readonly quota: string;
    readonly limit: number;
  }[];
}

const QUOTA = 'api.calls';
const OTHER_QUOTA = 'sms.sent';

/**
 * Unknown quotas are exhausted; bad amounts and keys are refused; nothing is consumed past the
 * limit; quotas are separate; a replayed idempotency key consumes nothing more.
 */
export function quotaProviderContract(
  create: AdapterFactory<QuotaSeed, QuotaProvider>,
): ContractSuite {
  const seeded = (limit: number): QuotaSeed => ({
    limits: [
      { tenantId: TENANT_A, quota: QUOTA, limit },
      { tenantId: TENANT_A, quota: OTHER_QUOTA, limit },
    ],
  });
  let keys = 0;
  const use = (
    amount: number,
    quota: string = QUOTA,
    idempotencyKey = `contract-${String((keys += 1))}`,
  ) => ({
    quota,
    amount,
    idempotencyKey,
  });
  const consume = (provider: QuotaProvider, u: QuotaUse, tenantId: TenantId = TENANT_A) =>
    consumeQuota(provider, contextFor(tenantId), u);

  return suite('QuotaProvider', [
    [
      'an unknown quota is UNKNOWN_QUOTA, never unlimited',
      async () => {
        const decision = await consume(await create({ limits: [] }), use(1));
        check(
          reasonOf(decision) === 'UNKNOWN_QUOTA',
          `expected UNKNOWN_QUOTA, got ${reasonOf(decision)}`,
        );
      },
    ],
    [
      'a quota set for one tenant is unknown in another',
      async () => {
        const decision = await consume(await create(seeded(5)), use(1), TENANT_B);
        check(
          reasonOf(decision) === 'UNKNOWN_QUOTA',
          `expected UNKNOWN_QUOTA, got ${reasonOf(decision)}`,
        );
      },
    ],
    [
      'the provider itself refuses NaN, zero, negative, fractional and unsafe amounts',
      async () => {
        const provider = await create(seeded(5));
        for (const amount of [Number.NaN, 0, -1, 1.5, Number.POSITIVE_INFINITY, 2 ** 53]) {
          const raw = await provider.consume(contextFor(TENANT_A), use(amount));
          check(!isAllowed(raw), `amount ${String(amount)} must be refused`);
          check(
            reasonOf(raw) === 'INVALID_AMOUNT',
            `expected INVALID_AMOUNT for ${String(amount)}, got ${reasonOf(raw)}`,
          );
        }
        const after = await consume(provider, use(5));
        check(after.allow && after.remaining === 0, 'refused amounts must not consume anything');
      },
    ],
    [
      'the provider itself refuses a blank idempotency key',
      async () => {
        const raw = await (
          await create(seeded(5))
        ).consume(contextFor(TENANT_A), use(1, QUOTA, ' '));
        check(reasonOf(raw) === 'INVALID_KEY', `expected INVALID_KEY, got ${reasonOf(raw)}`);
      },
    ],
    [
      'use within the limit is granted and counts down',
      async () => {
        const provider = await create(seeded(5));
        const first = await consume(provider, use(2));
        const second = await consume(provider, use(3));
        check(
          first.allow && first.remaining === 3,
          `expected 3 remaining, got ${JSON.stringify(first)}`,
        );
        check(
          second.allow && second.remaining === 0,
          `expected 0 remaining, got ${JSON.stringify(second)}`,
        );
      },
    ],
    [
      'use over the limit is EXHAUSTED and consumes nothing',
      async () => {
        const provider = await create(seeded(5));
        await consume(provider, use(3));
        const over = await consume(provider, use(3));
        const rest = await consume(provider, use(2));
        check(reasonOf(over) === 'EXHAUSTED', `expected EXHAUSTED, got ${reasonOf(over)}`);
        check(
          rest.allow && rest.remaining === 0,
          'a refused use must not consume part of the quota',
        );
      },
    ],
    [
      'quotas are counted separately',
      async () => {
        const provider = await create(seeded(2));
        await consume(provider, use(2, QUOTA));
        const exhausted = await consume(provider, use(1, QUOTA));
        const other = await consume(provider, use(1, OTHER_QUOTA));
        check(
          reasonOf(exhausted) === 'EXHAUSTED',
          `expected ${QUOTA} EXHAUSTED, got ${reasonOf(exhausted)}`,
        );
        check(
          other.allow && other.remaining === 1,
          `expected ${OTHER_QUOTA} untouched, got ${JSON.stringify(other)}`,
        );
      },
    ],
    [
      'a replayed idempotency key returns the first grant and consumes nothing more',
      async () => {
        const provider = await create(seeded(5));
        const first = await consume(provider, use(2, QUOTA, 'retry-1'));
        const replay = await consume(provider, use(2, QUOTA, 'retry-1'));
        const next = await consume(provider, use(1));
        check(
          first.allow && first.remaining === 3,
          `expected 3 remaining, got ${JSON.stringify(first)}`,
        );
        check(
          sameJson(replay, first),
          `the replay must return the first grant, got ${JSON.stringify(replay)}`,
        );
        check(
          next.allow && next.remaining === 2,
          `the replay must not consume, got ${JSON.stringify(next)}`,
        );
      },
    ],
    [
      'reusing a key for a different use is KEY_REUSED and consumes nothing',
      async () => {
        const provider = await create(seeded(5));
        await consume(provider, use(1, QUOTA, 'key-1'));
        const changed = await consume(provider, use(3, QUOTA, 'key-1'));
        const next = await consume(provider, use(1));
        check(reasonOf(changed) === 'KEY_REUSED', `expected KEY_REUSED, got ${reasonOf(changed)}`);
        check(
          next.allow && next.remaining === 3,
          `a refused reuse must not consume, got ${JSON.stringify(next)}`,
        );
      },
    ],
    [
      'concurrent use never exceeds the limit',
      async () => {
        const provider = await create(seeded(5));
        const decisions = await Promise.all(
          Array.from({ length: 20 }, () => consume(provider, use(1))),
        );
        const granted = decisions.filter((d) => d.allow).length;
        check(granted === 5, `expected exactly 5 grants, got ${String(granted)}`);
      },
    ],
    [
      'concurrent replays of one key consume once',
      async () => {
        const provider = await create(seeded(5));
        const replies = await Promise.all(
          Array.from({ length: 10 }, () => consume(provider, use(1, QUOTA, 'same-request'))),
        );
        check(
          replies.every((r) => sameJson(r, replies[0]) && r.allow),
          `every concurrent replay must get the same grant, got ${JSON.stringify(replies)}`,
        );
        const next = await consume(provider, use(1));
        check(
          next.allow && next.remaining === 3,
          `one key must consume once, got ${JSON.stringify(next)}`,
        );
      },
    ],
    [
      'the same key in two tenants is two separate uses',
      async () => {
        const provider = await create({
          limits: [
            { tenantId: TENANT_A, quota: QUOTA, limit: 5 },
            { tenantId: TENANT_B, quota: QUOTA, limit: 5 },
          ],
        });
        const inA = await consume(provider, use(2, QUOTA, 'shared-key'), TENANT_A);
        const inB = await consume(provider, use(3, QUOTA, 'shared-key'), TENANT_B);
        check(inA.allow && inA.remaining === 3, `tenant A: ${JSON.stringify(inA)}`);
        check(
          inB.allow && inB.remaining === 2,
          `a key from another tenant must not replay or clash: ${JSON.stringify(inB)}`,
        );
      },
    ],
  ]);
}

// ---------------------------------------------------------------- ClassificationLookup

export interface ClassificationSeed {
  readonly fields: readonly {
    readonly entity: string;
    readonly field: string;
    readonly classification: Classification;
    /** Set for a tenant's custom field; unset for a field declared in a manifest. */
    readonly tenantId?: TenantId;
  }[];
}

/** An unknown field is `secret`, the most restrictive class; custom fields stay in their tenant. */
export function classificationLookupContract(
  create: AdapterFactory<ClassificationSeed, ClassificationLookup>,
): ContractSuite {
  const phone = { entity: 'customer', field: 'phone' };

  return suite('ClassificationLookup', [
    [
      'an unknown field is secret',
      async () => {
        const lookup = await create({ fields: [] });
        const found = classifyField(lookup, contextFor(TENANT_A), phone);
        check(found === 'secret', `expected secret, got ${found}`);
      },
    ],
    [
      'an unknown field on a known entity is secret',
      async () => {
        const lookup = await create({ fields: [{ ...phone, classification: 'personal' }] });
        const raw = lookup.classify(contextFor(TENANT_A), { entity: 'customer', field: 'notes' });
        check(raw === 'secret', `expected secret, got ${raw}`);
      },
    ],
    [
      'a declared field returns its class, with or without a tenant',
      async () => {
        for (const classification of CLASSIFICATIONS) {
          const lookup = await create({ fields: [{ ...phone, classification }] });
          const inTenant = lookup.classify(contextFor(TENANT_A), phone);
          const platform = lookup.classify(contextWithoutTenant(), phone);
          check(inTenant === classification, `expected ${classification}, got ${inTenant}`);
          check(
            platform === classification,
            `expected ${classification} without a tenant, got ${platform}`,
          );
        }
      },
    ],
    [
      'a tenant cannot lower the class of a declared field',
      async () => {
        const lookup = await create({
          fields: [
            { ...phone, classification: 'personal' },
            { ...phone, classification: 'public', tenantId: TENANT_A },
          ],
        });
        const found = lookup.classify(contextFor(TENANT_A), phone);
        check(found === 'personal', `a tenant override lowered personal to ${found}`);
      },
    ],
    [
      'a tenant’s custom field is secret in another tenant and without a tenant',
      async () => {
        const custom = { entity: 'customer', field: 'cf_meter_no' };
        const lookup = await create({
          fields: [{ ...custom, classification: 'internal', tenantId: TENANT_A }],
        });
        const own = lookup.classify(contextFor(TENANT_A), custom);
        const other = lookup.classify(contextFor(TENANT_B), custom);
        const none = lookup.classify(contextWithoutTenant(), custom);
        check(own === 'internal', `expected internal in its own tenant, got ${own}`);
        check(other === 'secret', `expected secret in another tenant, got ${other}`);
        check(none === 'secret', `expected secret without a tenant, got ${none}`);
      },
    ],
  ]);
}
