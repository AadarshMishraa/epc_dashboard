import {
  createContext,
  parseAiClientId,
  parseCorrelationId,
  parseId,
  parseTenantId,
  requireTenant,
  type Actor,
  type AiClientScope,
  type Clock,
  type CorrelationId,
  type Id,
  type TenantContext,
  type TenantId,
} from '@gx/core';
import { frozenClock } from './clock.ts';

/** A fixed, readable id for fixtures: `testId(1)` is ...-000000000001. */
export function testId(n: number): Id {
  const id = parseId(`0190f3e2-7a1b-7c3d-8e4f-${String(n).padStart(12, '0')}`);
  if (id === undefined) throw new RangeError(`testId(${String(n)}) is out of range`);
  return id;
}

export function testTenant(n: number): TenantId {
  const id = parseTenantId(
    `0190f3e2-7a1b-7c3d-8e4f-${String(9_000_000_000 + n).padStart(12, '0')}`,
  );
  if (id === undefined) throw new RangeError(`testTenant(${String(n)}) is out of range`);
  return id;
}

export const TEST_CORRELATION: CorrelationId = parseCorrelationId(
  'test-correlation',
) as CorrelationId;

export interface TenantContextOptions {
  readonly tenantId?: TenantId;
  readonly actor?: Actor;
  readonly initiatedBy?: Actor;
  readonly causationId?: Id;
  readonly clock?: Clock;
}

/** A checked tenant context for tests; defaults to tenant 1 and user 1. */
export function tenantContext(options: TenantContextOptions = {}): TenantContext {
  const context = createContext({
    tenantId: options.tenantId ?? testTenant(1),
    actor: options.actor ?? { kind: 'user', userId: testId(1) },
    correlationId: TEST_CORRELATION,
    clock: options.clock ?? frozenClock(),
    ...(options.initiatedBy === undefined ? {} : { initiatedBy: options.initiatedBy }),
    ...(options.causationId === undefined ? {} : { causationId: options.causationId }),
  });
  const checked = requireTenant(context);
  if (!checked.ok) throw new Error('unreachable: the context has a tenant');
  return checked.value;
}

/** A user acting through an AI client with the given scopes (ADR-0005), with a validated client id. */
export function viaAiClient(userId: Id, scopes: readonly AiClientScope[]): Actor {
  const clientId = parseAiClientId('test-ai-client');
  if (clientId === undefined) throw new Error('unreachable: the fixture id is valid');
  return { kind: 'user', userId, via: { kind: 'ai_client', clientId, scopes } };
}
