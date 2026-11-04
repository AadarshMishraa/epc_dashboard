import {
  ALLOW,
  actorCeiling,
  grantSubject,
  checkEntitlement,
  deny,
  isValidQuotaAmount,
  type Authorizer,
  type ClassificationLookup,
  type DataClass,
  type Decision,
  type EntitlementDecision,
  type EntitlementGate,
  type PermissionMode,
  type QuotaDecision,
  type QuotaProvider,
  type TenantContext,
  type TenantId,
} from '@gx/core';

export interface AuthorizerSeed {
  /** Every known permission and whether it reads or writes. Unknown permissions are denied. */
  readonly permissions?: Readonly<Record<string, PermissionMode>>;
  /** `subject` is `grantSubject(actor)`: `user:<id>`, `operator:<id>`, `system:<process>` and so on. */
  readonly grants?: readonly {
    readonly tenantId: TenantId;
    readonly subject: string;
    readonly permission: string;
  }[];
}

/** Deny by default: an empty seed allows nothing. */
export function fakeAuthorizer(seed: AuthorizerSeed = {}): Authorizer {
  const permissions = new Map(Object.entries(seed.permissions ?? {}));
  const grants = new Set(
    (seed.grants ?? []).map((g) => `${g.tenantId}|${g.subject}|${g.permission}`),
  );
  return {
    can(context: TenantContext, permission: string): Promise<Decision> {
      const mode = permissions.get(permission);
      if (mode === undefined) return Promise.resolve(deny('UNKNOWN_PERMISSION'));
      const ceiling = actorCeiling(context.actor, mode);
      if (ceiling !== undefined) return Promise.resolve(deny(ceiling));
      const subject = grantSubject(context.actor);
      const granted =
        subject !== undefined && grants.has(`${context.tenantId}|${subject}|${permission}`);
      return Promise.resolve(granted ? ALLOW : deny('NO_GRANT'));
    },
  };
}

export interface EntitlementSeed {
  readonly keys?: readonly string[];
  readonly enabled?: readonly { readonly tenantId: TenantId; readonly key: string }[];
}

/** Unknown keys are denied, never enabled. */
export function fakeEntitlementGate(seed: EntitlementSeed = {}): EntitlementGate {
  const keys = new Set(seed.keys ?? []);
  const enabled = new Set((seed.enabled ?? []).map((e) => `${e.tenantId}|${e.key}`));
  const gate: EntitlementGate = {
    check(context, key): Promise<EntitlementDecision> {
      if (!keys.has(key)) return Promise.resolve({ enabled: false, reason: 'UNKNOWN_KEY' });
      return Promise.resolve(
        enabled.has(`${context.tenantId}|${key}`)
          ? { enabled: true }
          : { enabled: false, reason: 'NOT_ENABLED' },
      );
    },
  };
  return { check: (context, key) => checkEntitlement(gate, context, key) };
}

export interface QuotaSeed {
  readonly limits?: readonly {
    readonly tenantId: TenantId;
    readonly quota: string;
    readonly limit: number;
  }[];
}

/** Unknown quotas are exhausted; consumption is atomic (all or nothing). */
export function fakeQuotaProvider(seed: QuotaSeed = {}): QuotaProvider {
  for (const l of seed.limits ?? []) {
    if (!Number.isSafeInteger(l.limit) || l.limit < 0) {
      throw new RangeError(`quota limit for ${l.quota} must be a whole number of at least 0`);
    }
  }
  const remaining = new Map((seed.limits ?? []).map((l) => [`${l.tenantId}|${l.quota}`, l.limit]));
  return {
    consume(context, quota, amount): Promise<QuotaDecision> {
      if (!isValidQuotaAmount(amount))
        return Promise.resolve({ granted: false, reason: 'INVALID_AMOUNT' });
      const key = `${context.tenantId}|${quota}`;
      const left = remaining.get(key);
      if (left === undefined) return Promise.resolve({ granted: false, reason: 'UNKNOWN_QUOTA' });
      if (left < amount) return Promise.resolve({ granted: false, reason: 'EXHAUSTED' });
      remaining.set(key, left - amount);
      return Promise.resolve({ granted: true, remaining: left - amount });
    },
  };
}

export interface ClassificationSeed {
  readonly fields?: readonly {
    readonly entity: string;
    readonly field: string;
    readonly class: DataClass;
  }[];
}

/** An unknown field is `secret`, the most restrictive class. */
export function fakeClassificationLookup(seed: ClassificationSeed = {}): ClassificationLookup {
  const fields = new Map((seed.fields ?? []).map((f) => [`${f.entity}.${f.field}`, f.class]));
  return { classify: (entity, field) => fields.get(`${entity}.${field}`) ?? 'secret' };
}
