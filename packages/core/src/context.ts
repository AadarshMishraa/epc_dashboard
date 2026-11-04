import type { Clock } from './clock.ts';
import { coreError, type AppError } from './errors.ts';
import type { Id } from './ids.ts';
import { err, ok, type Result } from './result.ts';

declare const correlationIdBrand: unique symbol;

/** Ties together every log line, job and event caused by one request. */
export type CorrelationId = string & { readonly [correlationIdBrand]: true };

/** Tenant ids are record ids; the tenancy module (K1) owns the tenant record. */
export type TenantId = Id;

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * Accepts a correlation id from an untrusted source (a header, a queued job) only if it is
 * 1 to 128 characters of letters, digits and `._:-`, so it cannot inject log lines or markup.
 */
export function parseCorrelationId(value: unknown): CorrelationId | undefined {
  return typeof value === 'string' && CORRELATION_ID_PATTERN.test(value)
    ? (value as CorrelationId)
    : undefined;
}

/**
 * Who is acting. Ids only, never names or contact details, so an actor is safe to log.
 * An AI client always acts for a user and never beyond that user's permissions (ADR-0005).
 */
export type Actor =
  | { readonly kind: 'user'; readonly userId: Id; readonly via?: AiClient }
  | { readonly kind: 'service_account'; readonly serviceAccountId: Id }
  | { readonly kind: 'operator'; readonly operatorId: Id; readonly supportSessionId: Id }
  | { readonly kind: 'system'; readonly process: string }
  | { readonly kind: 'anonymous' };

export interface AiClient {
  readonly kind: 'ai_client';
  readonly clientId: string;
}

/**
 * Carried explicitly through every request, job and event handler. The tenant is optional
 * here because platform operations have none; tenant-scoped code calls `requireTenant`,
 * which fails closed.
 */
export interface Context {
  readonly tenantId?: TenantId;
  readonly actor: Actor;
  readonly correlationId: CorrelationId;
  /** The event or job that caused this work, when it is not a direct request. */
  readonly causationId?: Id;
  readonly clock: Clock;
}

export interface ContextInput {
  readonly tenantId?: TenantId;
  readonly actor: Actor;
  readonly correlationId: CorrelationId;
  readonly causationId?: Id;
  readonly clock: Clock;
}

export function createContext(input: ContextInput): Context {
  return Object.freeze({
    actor: Object.freeze({ ...input.actor }),
    correlationId: input.correlationId,
    clock: input.clock,
    ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
    ...(input.causationId === undefined ? {} : { causationId: input.causationId }),
  });
}

/**
 * The context for work caused by an event or job: same tenant, actor, correlation id and
 * clock, with the cause recorded. Optionally a different actor, for example the system
 * process that runs a scheduled job.
 */
export function deriveContext(
  parent: Context,
  change: { readonly causationId: Id; readonly actor?: Actor },
): Context {
  return createContext({
    actor: change.actor ?? parent.actor,
    correlationId: parent.correlationId,
    clock: parent.clock,
    causationId: change.causationId,
    ...(parent.tenantId === undefined ? {} : { tenantId: parent.tenantId }),
  });
}

/** The tenant of this context, or TENANT_REQUIRED. There is no default tenant. */
export function requireTenant(context: Context): Result<TenantId, AppError<'TENANT_REQUIRED'>> {
  return context.tenantId === undefined
    ? err(coreError('TENANT_REQUIRED', { detail: 'tenant-scoped code ran without a tenant' }))
    : ok(context.tenantId);
}
