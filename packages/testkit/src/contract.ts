import {
  createContext,
  parseCorrelationId,
  parseId,
  parseTenantId,
  requireTenant,
  type Actor,
  type Clock,
  type Context,
  type CorrelationId,
  type Id,
  type TenantContext,
  type TenantId,
} from '@gx/core';

/**
 * One adapter-agnostic check. Suites are plain data, so any test runner can run them:
 * `for (const c of suite.cases) it(c.name, c.run)`. A case throws `ContractViolation` when
 * the adapter breaks the contract.
 */
export interface ContractCase {
  readonly name: string;
  readonly run: () => Promise<void>;
}

export interface ContractSuite {
  /** The core port the suite checks, for example `Authorizer`. */
  readonly port: string;
  readonly cases: readonly ContractCase[];
}

/**
 * Builds a fresh adapter for one case, seeded through the adapter's own setup path, over
 * empty storage: a database adapter truncates its tables here (or in the runner's
 * afterEach) and creates rows for `CONTRACT_TENANTS` first.
 */
export type AdapterFactory<Seed, Port> = (seed: Seed) => Port | Promise<Port>;

/** Reads back what an adapter stored for one tenant, so a suite can check it. */
export type TenantReader<R> = (tenantId: TenantId) => readonly R[] | Promise<readonly R[]>;

export class ContractViolation extends Error {
  override readonly name = 'ContractViolation';
}

export function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ContractViolation(message);
}

export function suite(
  port: string,
  cases: readonly (readonly [name: string, run: () => Promise<void>])[],
): ContractSuite {
  return Object.freeze({
    port,
    cases: Object.freeze(cases.map(([name, run]) => Object.freeze({ name, run }))),
  });
}

/** Same value as plain JSON; enough for the frozen, JSON-shaped values ports return. */
export function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function deepFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(deepFrozen);
}

// Fixtures the suites share. Fixed ids and a fixed clock keep every run identical.
const fixedId = (value: string): Id => {
  const id = parseId(value);
  if (id === undefined) throw new Error(`invalid fixture id ${value}`);
  return id;
};
const fixedTenant = (value: string): TenantId => {
  const id = parseTenantId(value);
  if (id === undefined) throw new Error(`invalid fixture tenant ${value}`);
  return id;
};

export const FIXTURE_MILLIS = 1_767_225_600_000; // 2026-01-01T00:00:00Z
const fixtureClock: Clock = Object.freeze({
  nowMillis: () => FIXTURE_MILLIS,
  monotonicMillis: () => 0,
});
const fixtureCorrelation = parseCorrelationId('contract-test') as CorrelationId;

export const TENANT_A = fixedTenant('0190f3e2-7a1b-7c3d-8e4f-00000000a001');
export const TENANT_B = fixedTenant('0190f3e2-7a1b-7c3d-8e4f-00000000a002');
export const USER_1 = fixedId('0190f3e2-7a1b-7c3d-8e4f-00000000b001');
export const USER_2 = fixedId('0190f3e2-7a1b-7c3d-8e4f-00000000b002');
export const RECORD_1 = fixedId('0190f3e2-7a1b-7c3d-8e4f-00000000c001');
export const EVENT_1 = fixedId('0190f3e2-7a1b-7c3d-8e4f-00000000d001');

/** Tenants and users the suites use, so a database adapter can create their rows first. */
export const CONTRACT_TENANTS: readonly TenantId[] = Object.freeze([TENANT_A, TENANT_B]);
export const CONTRACT_USERS: readonly Id[] = Object.freeze([USER_1, USER_2]);

export const user1: Actor = Object.freeze({ kind: 'user', userId: USER_1 });
export const user2: Actor = Object.freeze({ kind: 'user', userId: USER_2 });

export function contextFor(tenantId: TenantId, actor: Actor = user1): TenantContext {
  const result = requireTenant(
    createContext({ tenantId, actor, correlationId: fixtureCorrelation, clock: fixtureClock }),
  );
  if (!result.ok) throw new Error('fixture context has no tenant');
  return result.value;
}

export function contextWithoutTenant(actor: Actor = user1): Context {
  return createContext({ actor, correlationId: fixtureCorrelation, clock: fixtureClock });
}
