import type { Clock } from './clock.ts';
import { coreError, type AppError } from './errors.ts';
import { isId, type Id } from './ids.ts';
import { err, ok, type Result } from './result.ts';
import { redactString } from './logging/redact.ts';

declare const correlationIdBrand: unique symbol;
declare const tenantIdBrand: unique symbol;
declare const aiClientIdBrand: unique symbol;

/** Ties together every log line, job and event caused by one request. */
export type CorrelationId = string & { readonly [correlationIdBrand]: true };

/**
 * A tenant's id. Its own brand, so a user, record or event id cannot be passed where a
 * tenant is expected (security guidelines 4.1). The tenancy module (K1) owns the record.
 */
export type TenantId = Id & { readonly [tenantIdBrand]: true };

/** An AI client's registered id (ADR-0005); validated because the client chooses it. */
export type AiClientId = string & { readonly [aiClientIdBrand]: true };

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
/** Printable ASCII without spaces, quotes or angle brackets; long enough for a URL-form id. */
const AI_CLIENT_ID_PATTERN = /^[A-Za-z0-9._:/?#&=%~+-]{1,256}$/;

/**
 * Accepts a correlation id from an untrusted source (a header, a queued job) only if it is
 * 1 to 128 characters of letters, digits and `._:-`, so it cannot inject log lines or markup,
 * and holds nothing the log backstop would mask (a phone number, a long number), so it stays
 * readable and unique in logs. A rejected id means the caller mints a fresh one.
 */
export function parseCorrelationId(value: unknown): CorrelationId | undefined {
  return typeof value === 'string' &&
    CORRELATION_ID_PATTERN.test(value) &&
    redactString(value) === value
    ? (value as CorrelationId)
    : undefined;
}

/** A new correlation id from a fresh record id, for a request or job that arrived without one. */
export function correlationIdFromId(id: Id): CorrelationId {
  return id as string as CorrelationId;
}

/**
 * Checks the format of a tenant id and brands it. This is not authorization: it does not
 * prove the caller may act in that tenant. Only the tenant resolver (K1) decides that.
 */
export function parseTenantId(value: unknown): TenantId | undefined {
  return isId(value) ? (value as TenantId) : undefined;
}

export function parseAiClientId(value: unknown): AiClientId | undefined {
  return typeof value === 'string' && AI_CLIENT_ID_PATTERN.test(value)
    ? (value as AiClientId)
    : undefined;
}

/** What an AI client was granted; it never exceeds the user's own permissions. */
export type AiClientScope = 'read' | 'write';

export interface AiClient {
  readonly kind: 'ai_client';
  readonly clientId: AiClientId;
  readonly scopes: readonly AiClientScope[];
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

/**
 * Carried explicitly through every request, job and event handler. The tenant is optional
 * because platform operations have none. Tenant-scoped code takes a `TenantContext`,
 * which only `requireTenant` produces, so skipping the check does not compile.
 */
export interface Context {
  readonly tenantId?: TenantId;
  /** Who is doing the work now. */
  readonly actor: Actor;
  /** Who started the chain, when that differs from `actor` (a job run by a system process). */
  readonly initiatedBy?: Actor;
  readonly correlationId: CorrelationId;
  /** The event or job that caused this work, when it is not a direct request. */
  readonly causationId?: Id;
  readonly clock: Clock;
}

declare const tenantContextBrand: unique symbol;

/** A context proven to have a tenant. */
export type TenantContext = Context & {
  readonly tenantId: TenantId;
  readonly [tenantContextBrand]: true;
};

export interface ContextInput {
  readonly tenantId?: TenantId;
  readonly actor: Actor;
  readonly initiatedBy?: Actor;
  readonly correlationId: CorrelationId;
  readonly causationId?: Id;
  readonly clock: Clock;
}

export function createContext(input: ContextInput): Context {
  return Object.freeze({
    actor: freezeActor(input.actor),
    correlationId: input.correlationId,
    clock: input.clock,
    ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
    ...(input.initiatedBy === undefined ? {} : { initiatedBy: freezeActor(input.initiatedBy) }),
    ...(input.causationId === undefined ? {} : { causationId: input.causationId }),
  });
}

/**
 * The context for work caused by an event or job: same tenant, correlation id and clock,
 * with the cause recorded. With a different actor (a system process running a job), the
 * original actor is kept as `initiatedBy`, so audit and events still know who started it.
 */
export function deriveContext(
  parent: TenantContext,
  change: { readonly causationId: Id; readonly actor?: Actor },
): TenantContext;
export function deriveContext(
  parent: Context,
  change: { readonly causationId: Id; readonly actor?: Actor },
): Context;
export function deriveContext(
  parent: Context,
  change: { readonly causationId: Id; readonly actor?: Actor },
): Context {
  const initiatedBy =
    change.actor === undefined ? parent.initiatedBy : (parent.initiatedBy ?? parent.actor);
  return createContext({
    actor: change.actor ?? parent.actor,
    correlationId: parent.correlationId,
    clock: parent.clock,
    causationId: change.causationId,
    ...(parent.tenantId === undefined ? {} : { tenantId: parent.tenantId }),
    ...(initiatedBy === undefined ? {} : { initiatedBy }),
  });
}

/** Proves the context has a tenant, or fails with TENANT_REQUIRED. There is no default tenant. */
export function requireTenant(
  context: Context,
): Result<TenantContext, AppError<'TENANT_REQUIRED'>> {
  return context.tenantId === undefined
    ? err(coreError('TENANT_REQUIRED', { detail: 'tenant-scoped code ran without a tenant' }))
    : ok(context as TenantContext);
}

/** A frozen copy of an actor; records keep this, never the caller's object. */
export function freezeActor(actor: Actor): Actor {
  if (actor.kind === 'user' && actor.via !== undefined) {
    const via: AiClient = Object.freeze({
      kind: 'ai_client',
      clientId: actor.via.clientId,
      scopes: Object.freeze([...actor.via.scopes]),
    });
    return Object.freeze({ kind: 'user', userId: actor.userId, via });
  }
  return Object.freeze({ ...actor });
}
