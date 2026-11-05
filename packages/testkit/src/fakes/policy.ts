import {
  actorModeDenial,
  ALLOW,
  deny,
  isIdempotencyKey,
  isQuotaAmount,
  type Actor,
  type AuthorizationDenial,
  type AuthorizationRequest,
  type Authorizer,
  type Classification,
  type ClassificationLookup,
  type Context,
  type Decision,
  type EntitlementDenial,
  type EntitlementGate,
  type FieldRef,
  type PermissionMode,
  type QuotaDecision,
  type QuotaGrant,
  type QuotaProvider,
  type QuotaUse,
  type TenantContext,
  type TenantId,
} from '@gx/core';
import type {
  AuthorizerSeed,
  ClassificationSeed,
  EntitlementSeed,
  QuotaSeed,
} from '../contracts/policy.ts';

// Composite map keys as JSON arrays, so no name can collide with a separator.
const key = (...parts: readonly string[]): string => JSON.stringify(parts);

/** Who a grant belongs to. An AI client acts with its user's grants; anonymous has none. */
function grantHolder(actor: Actor): string | undefined {
  switch (actor.kind) {
    case 'user':
      return `user:${actor.userId}`;
    case 'service_account':
      return `service_account:${actor.serviceAccountId}`;
    case 'operator':
      return `operator:${actor.operatorId}`;
    case 'system':
      return `system:${actor.process}`;
    case 'anonymous':
      return undefined;
  }
}

/**
 * In-memory Authorizer. Starts empty, so it denies everything; permissions and grants are
 * seeded explicitly. `failWith` makes every check reject, to test that callers fail closed.
 */
export class FakeAuthorizer implements Authorizer {
  readonly #modes = new Map<string, PermissionMode>();
  readonly #grants = new Set<string>();
  #failure: Error | undefined;

  constructor(seed: Partial<AuthorizerSeed> = {}) {
    for (const { name, mode } of seed.permissions ?? []) this.definePermission(name, mode);
    for (const { tenantId, actor, permission } of seed.grants ?? [])
      this.grant(tenantId, actor, permission);
  }

  definePermission(name: string, mode: PermissionMode): void {
    this.#modes.set(name, mode);
  }

  grant(tenantId: TenantId, actor: Actor, permission: string): void {
    const holder = grantHolder(actor);
    if (holder === undefined) throw new TypeError('An anonymous actor cannot hold a grant');
    this.#grants.add(key(tenantId, holder, permission));
  }

  failWith(error: Error | undefined): void {
    this.#failure = error;
  }

  check(
    context: TenantContext,
    request: AuthorizationRequest,
  ): Promise<Decision<AuthorizationDenial>> {
    if (this.#failure !== undefined) return Promise.reject(this.#failure);
    const mode = this.#modes.get(request.permission);
    if (mode === undefined) return Promise.resolve(deny('UNKNOWN_PERMISSION'));
    const actorDenial = actorModeDenial(context.actor, mode);
    if (actorDenial !== undefined) return Promise.resolve(actorDenial);
    const holder = grantHolder(context.actor);
    const granted =
      holder !== undefined && this.#grants.has(key(context.tenantId, holder, request.permission));
    return Promise.resolve(granted ? ALLOW : deny('NO_GRANT'));
  }
}

/** In-memory EntitlementGate. Unknown keys are denied; enablement is per tenant. */
export class FakeEntitlementGate implements EntitlementGate {
  readonly #keys = new Set<string>();
  readonly #enabled = new Set<string>();
  #failure: Error | undefined;

  constructor(seed: Partial<EntitlementSeed> = {}) {
    for (const entitlement of seed.keys ?? []) this.defineKey(entitlement);
    for (const { tenantId, key: entitlement } of seed.enabled ?? [])
      this.enable(tenantId, entitlement);
  }

  defineKey(entitlement: string): void {
    this.#keys.add(entitlement);
  }

  enable(tenantId: TenantId, entitlement: string): void {
    this.#enabled.add(key(tenantId, entitlement));
  }

  failWith(error: Error | undefined): void {
    this.#failure = error;
  }

  check(context: TenantContext, entitlement: string): Promise<Decision<EntitlementDenial>> {
    if (this.#failure !== undefined) return Promise.reject(this.#failure);
    if (!this.#keys.has(entitlement)) return Promise.resolve(deny('UNKNOWN_KEY'));
    return Promise.resolve(
      this.#enabled.has(key(context.tenantId, entitlement)) ? ALLOW : deny('NOT_ENTITLED'),
    );
  }
}

/**
 * In-memory QuotaProvider. Unknown quotas are exhausted; a granted idempotency key replays
 * its first grant. The check and the decrement run in
 * one synchronous step, so concurrent calls cannot oversell; a real adapter needs an atomic
 * update for the same guarantee.
 */
export class FakeQuotaProvider implements QuotaProvider {
  readonly #limits = new Map<string, number>();
  readonly #used = new Map<string, number>();
  readonly #grants = new Map<string, { quota: string; amount: number; grant: QuotaGrant }>();
  #failure: Error | undefined;

  constructor(seed: Partial<QuotaSeed> = {}) {
    for (const { tenantId, quota, limit } of seed.limits ?? [])
      this.setLimit(tenantId, quota, limit);
  }

  setLimit(tenantId: TenantId, quota: string, limit: number): void {
    if (!(Number.isSafeInteger(limit) && limit >= 0)) {
      throw new RangeError(
        `A quota limit must be a whole number of at least 0, found ${String(limit)}`,
      );
    }
    this.#limits.set(key(tenantId, quota), limit);
  }

  used(tenantId: TenantId, quota: string): number {
    return this.#used.get(key(tenantId, quota)) ?? 0;
  }

  failWith(error: Error | undefined): void {
    this.#failure = error;
  }

  consume(context: TenantContext, use: QuotaUse): Promise<QuotaDecision> {
    if (this.#failure !== undefined) return Promise.reject(this.#failure);
    const { quota, amount, idempotencyKey } = use;
    if (!isQuotaAmount(amount)) return Promise.resolve(deny('INVALID_AMOUNT'));
    if (!isIdempotencyKey(idempotencyKey)) return Promise.resolve(deny('INVALID_KEY'));
    const replayKey = key(context.tenantId, idempotencyKey);
    const replay = this.#grants.get(replayKey);
    if (replay !== undefined) {
      const same = replay.quota === quota && replay.amount === amount;
      return Promise.resolve(same ? replay.grant : deny('KEY_REUSED'));
    }
    const id = key(context.tenantId, quota);
    const limit = this.#limits.get(id);
    if (limit === undefined) return Promise.resolve(deny('UNKNOWN_QUOTA'));
    const used = this.#used.get(id) ?? 0;
    if (used + amount > limit) return Promise.resolve(deny('EXHAUSTED'));
    this.#used.set(id, used + amount);
    const grant: QuotaGrant = Object.freeze({ allow: true, remaining: limit - used - amount });
    // Only grants are remembered: a refused use may be retried after the limit is raised.
    this.#grants.set(replayKey, { quota, amount, grant });
    return Promise.resolve(grant);
  }
}

/** In-memory ClassificationLookup. Unknown fields are `secret`; custom fields stay in their tenant. */
export class FakeClassificationLookup implements ClassificationLookup {
  readonly #fields = new Map<string, Classification>();
  #failure: Error | undefined;

  constructor(seed: Partial<ClassificationSeed> = {}) {
    for (const { entity, field, classification, tenantId } of seed.fields ?? []) {
      this.define({ entity, field }, classification, tenantId);
    }
  }

  define(field: FieldRef, classification: Classification, tenantId?: TenantId): void {
    this.#fields.set(key(tenantId ?? '', field.entity, field.field), classification);
  }

  failWith(error: Error | undefined): void {
    this.#failure = error;
  }

  classify(context: Context, field: FieldRef): Classification {
    if (this.#failure !== undefined) throw this.#failure;
    const declared = this.#fields.get(key('', field.entity, field.field));
    if (declared !== undefined) return declared;
    if (context.tenantId === undefined) return 'secret';
    return this.#fields.get(key(context.tenantId, field.entity, field.field)) ?? 'secret';
  }
}
