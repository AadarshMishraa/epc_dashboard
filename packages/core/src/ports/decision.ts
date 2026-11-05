/**
 * Policy ports answer with a tagged decision, never a boolean, so a missing value, a thrown
 * error or a truthy string can never be read as "yes".
 */
export interface Allow {
  readonly allow: true;
}

export interface Deny<R extends string> {
  readonly allow: false;
  readonly reason: R;
}

/** The adapter threw or returned something that is not a decision. `cause` is for logs only. */
export interface DenyOnError {
  readonly allow: false;
  readonly reason: 'ERROR';
  readonly cause: unknown;
}

export type Decision<R extends string> = Allow | Deny<R>;

export const ALLOW: Allow = Object.freeze({ allow: true });

export function deny<const R extends string>(reason: R): Deny<R> {
  return Object.freeze({ allow: false, reason });
}

/**
 * True only for an object whose own `allow` is exactly `true`. Own properties only, so a
 * polluted `Object.prototype.allow` can never turn a denial into an allow.
 */
export function isAllowed(decision: unknown): decision is Allow {
  try {
    return (
      typeof decision === 'object' &&
      decision !== null &&
      Object.hasOwn(decision, 'allow') &&
      (decision as { allow?: unknown }).allow === true
    );
  } catch {
    // A getter that throws is not a yes.
    return false;
  }
}

export function denyOnError(cause: unknown): DenyOnError {
  return Object.freeze({ allow: false, reason: 'ERROR', cause });
}

export function denialReason<R extends string>(
  value: unknown,
  reasons: readonly R[],
): R | undefined {
  try {
    if (typeof value !== 'object' || value === null) return undefined;
    if (!Object.hasOwn(value, 'allow') || !Object.hasOwn(value, 'reason')) return undefined;
    const { allow, reason } = value as { allow?: unknown; reason?: unknown };
    return allow === false && (reasons as readonly unknown[]).includes(reason)
      ? (reason as R)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Runs an adapter call and keeps only a well-formed decision; anything else is a denial. */
export async function settleDecision<R extends string>(
  reasons: readonly R[],
  run: () => Promise<unknown>,
): Promise<Decision<R> | DenyOnError> {
  let value: unknown;
  try {
    value = await run();
  } catch (cause) {
    return denyOnError(cause);
  }
  if (isAllowed(value)) return ALLOW;
  const reason = denialReason(value, reasons);
  if (reason !== undefined) return deny(reason);
  return denyOnError(new TypeError(`adapter returned ${describe(value)}, not a decision`));
}

/** Names the kind of value only; the value itself may be sensitive. */
export function describe(value: unknown): string {
  return value === null ? 'null' : Array.isArray(value) ? 'an array' : typeof value;
}
