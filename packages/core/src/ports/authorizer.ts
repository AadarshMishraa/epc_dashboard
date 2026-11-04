import type { Actor, TenantContext } from '../context.ts';
import type { Id } from '../ids.ts';

/** Whether a permission only reads, or changes something. Declared with the permission in its manifest. */
export type PermissionMode = 'read' | 'write';

export interface ResourceRef {
  /** Entity name, for example `invoice`. */
  readonly type: string;
  readonly id?: Id;
}

export type DenyReason =
  'NO_GRANT' | 'UNKNOWN_PERMISSION' | 'SCOPE_EXCEEDED' | 'SUPPORT_READ_ONLY' | 'AUTHORIZER_FAILED';

/** Never a boolean: a deny always says why, and anything that is not `{ allow: true }` is a deny. */
export type Decision =
  { readonly allow: true } | { readonly allow: false; readonly reason: DenyReason };

export const ALLOW: Decision = Object.freeze({ allow: true });

export function deny(reason: DenyReason): Decision {
  return Object.freeze({ allow: false, reason });
}

/** Decides whether the context's actor may use `permission` on `resource`. Implemented by K2. */
export interface Authorizer {
  can(context: TenantContext, permission: string, resource: ResourceRef): Promise<Decision>;
}

/** True only for exactly `{ allow: true }`; undefined, booleans and malformed answers are denies. */
export function isAllowed(decision: unknown): boolean {
  return (
    typeof decision === 'object' &&
    decision !== null &&
    (decision as { allow?: unknown }).allow === true
  );
}

/**
 * Asks an Authorizer and fails closed: a thrown error or a malformed answer becomes
 * `deny('AUTHORIZER_FAILED')`. Callers use this, never `authorizer.can` directly.
 */
export async function authorize(
  authorizer: Authorizer,
  context: TenantContext,
  permission: string,
  resource: ResourceRef,
): Promise<Decision> {
  try {
    const decision: unknown = await authorizer.can(context, permission, resource);
    if (isAllowed(decision)) return ALLOW;
    const reason = (decision as { reason?: unknown } | null)?.reason;
    return typeof reason === 'string' && DENY_REASONS.has(reason)
      ? deny(reason as DenyReason)
      : deny('AUTHORIZER_FAILED');
  } catch {
    // The caller learns only that access is denied; the adapter logs its own failure.
    return deny('AUTHORIZER_FAILED');
  }
}

const DENY_REASONS: ReadonlySet<string> = new Set<DenyReason>([
  'NO_GRANT',
  'UNKNOWN_PERMISSION',
  'SCOPE_EXCEEDED',
  'SUPPORT_READ_ONLY',
  'AUTHORIZER_FAILED',
]);

/**
 * The ceiling on what an actor can do, before any grant is considered: an AI client acts
 * for a user and needs the `write` scope to write (ADR-0005); a support operator is
 * read-only by default (security guidelines 4.1). Every Authorizer applies this first.
 */
export function actorCeiling(actor: Actor, mode: PermissionMode): DenyReason | undefined {
  if (mode === 'read') return undefined;
  if (actor.kind === 'user' && actor.via !== undefined && !actor.via.scopes.includes('write')) {
    return 'SCOPE_EXCEEDED';
  }
  if (actor.kind === 'operator') return 'SUPPORT_READ_ONLY';
  return undefined;
}
