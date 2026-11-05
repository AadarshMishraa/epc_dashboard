import type { Actor, TenantContext } from '../context.ts';
import type { Id } from '../ids.ts';
import { deny, settleDecision, type Decision, type Deny, type DenyOnError } from './decision.ts';

/** Whether a permission reads or changes data; AI-client scopes and operators are checked against it. */
export type PermissionMode = 'read' | 'write';

/** A record a permission is checked against, for attribute conditions (K2). */
export interface ResourceRef {
  /** The owning module's entity name, snake_case, for example `invoice_line`. */
  readonly type: string;
  readonly id: Id;
}

export interface AuthorizationRequest {
  /** `entity.action` as declared in a module manifest, for example `invoice.read`. */
  readonly permission: string;
  readonly resource?: ResourceRef;
}

export const AUTHORIZATION_DENIALS = Object.freeze([
  'UNKNOWN_PERMISSION',
  'UNAUTHENTICATED',
  'OPERATOR_READ_ONLY',
  'SCOPE_EXCEEDED',
  'NO_GRANT',
] as const);
export type AuthorizationDenial = (typeof AUTHORIZATION_DENIALS)[number];
export type AuthorizationDecision = Decision<AuthorizationDenial> | DenyOnError;

/**
 * Decides whether the context's actor may use a permission in the context's tenant. Deny by
 * default: an unknown permission, an actor without a grant and an empty grant set all deny.
 * Implemented by K2; call it through `authorize`, never directly.
 */
export interface Authorizer {
  check(
    context: TenantContext,
    request: AuthorizationRequest,
  ): Promise<Decision<AuthorizationDenial>>;
}

/** Asks the authorizer and fails closed: a throw or a malformed answer is a denial. */
export function authorize(
  authorizer: Authorizer,
  context: TenantContext,
  request: AuthorizationRequest,
): Promise<AuthorizationDecision> {
  return settleDecision(AUTHORIZATION_DENIALS, () =>
    // No permission is ever granted to an anonymous caller, so the adapter is not asked.
    // Inside the guard, so a malformed context becomes a denial, not a throw.
    context.actor.kind === 'anonymous'
      ? Promise.resolve(deny('UNAUTHENTICATED'))
      : authorizer.check(context, request),
  );
}

/**
 * The checks that depend on who the actor is, before any grant is looked up: anonymous
 * callers have no permissions, support operators only read, and an AI client needs the
 * permission's mode in its scopes (ADR-0005). Undefined means "check the grants".
 * Every Authorizer adapter applies this first, so they agree.
 */
export function actorModeDenial(
  actor: Actor,
  mode: PermissionMode,
): Deny<'UNAUTHENTICATED' | 'OPERATOR_READ_ONLY' | 'SCOPE_EXCEEDED'> | undefined {
  switch (actor.kind) {
    case 'anonymous':
      return deny('UNAUTHENTICATED');
    case 'operator':
      return mode === 'write' ? deny('OPERATOR_READ_ONLY') : undefined;
    case 'user': {
      if (actor.via === undefined) return undefined;
      // Exact scope: a write scope does not imply read, so a client gets only what it was
      // granted. A non-array (a context rebuilt from a job payload) grants nothing.
      const scopes: unknown = actor.via.scopes;
      return Array.isArray(scopes) && scopes.includes(mode) ? undefined : deny('SCOPE_EXCEEDED');
    }
    case 'service_account':
    case 'system':
      return undefined;
    default:
      // An actor kind this version does not know (a rebuilt or newer context) has no rights.
      return deny('UNAUTHENTICATED');
  }
}
