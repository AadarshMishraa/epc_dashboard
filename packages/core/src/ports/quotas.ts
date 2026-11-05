import type { TenantContext } from '../context.ts';
import {
  deny,
  denialReason,
  denyOnError,
  describe,
  type Deny,
  type DenyOnError,
} from './decision.ts';
import { isNonBlankString } from './names.ts';

export const QUOTA_DENIALS = Object.freeze([
  'UNKNOWN_QUOTA',
  'EXHAUSTED',
  'INVALID_AMOUNT',
  'INVALID_KEY',
  'KEY_REUSED',
] as const);
export type QuotaDenial = (typeof QUOTA_DENIALS)[number];

const IDEMPOTENCY_KEY_MAX_LENGTH = 255;

export interface QuotaUse {
  readonly quota: string;
  /** A safe integer of at least 1. */
  readonly amount: number;
  /**
   * Identifies this use across retries (an HTTP retry, an outbox redelivery). Replaying a key
   * with the same quota and amount returns the first grant and uses nothing more; replaying
   * it with a different quota or amount is `KEY_REUSED`.
   */
  readonly idempotencyKey: string;
}

export interface QuotaGrant {
  readonly allow: true;
  /** What was left after this use. */
  readonly remaining: number;
}

export type QuotaDecision = QuotaGrant | Deny<QuotaDenial>;

/**
 * Counts use against a tenant's limit. An unknown quota is exhausted, never unlimited; a use
 * over the limit consumes nothing; a replayed key consumes nothing. Units are returned by
 * consuming inside the action's transaction, so a rolled-back action gives them back.
 * Implemented by K3; call it through `consumeQuota`.
 */
export interface QuotaProvider {
  consume(context: TenantContext, use: QuotaUse): Promise<QuotaDecision>;
}

export function isQuotaAmount(amount: unknown): amount is number {
  return typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 1;
}

export function isIdempotencyKey(key: unknown): key is string {
  return isNonBlankString(key) && key.length <= IDEMPOTENCY_KEY_MAX_LENGTH;
}

/** Validates the use, asks the provider, and fails closed on a throw or a malformed answer. */
export async function consumeQuota(
  provider: QuotaProvider,
  context: TenantContext,
  use: QuotaUse,
): Promise<QuotaDecision | DenyOnError> {
  if (!isQuotaAmount(use.amount)) return deny('INVALID_AMOUNT');
  if (!isIdempotencyKey(use.idempotencyKey)) return deny('INVALID_KEY');
  try {
    const value: unknown = await provider.consume(context, {
      quota: use.quota,
      amount: use.amount,
      idempotencyKey: use.idempotencyKey,
    });
    const remaining = grantedRemaining(value);
    if (remaining !== undefined) return Object.freeze({ allow: true, remaining });
    const reason = denialReason(value, QUOTA_DENIALS);
    if (reason !== undefined) return deny(reason);
    return denyOnError(new TypeError(`quota provider returned ${describe(value)}, not a decision`));
  } catch (cause) {
    return denyOnError(cause);
  }
}

function grantedRemaining(value: unknown): number | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { allow, remaining } = value as { allow?: unknown; remaining?: unknown };
  return allow === true &&
    typeof remaining === 'number' &&
    Number.isSafeInteger(remaining) &&
    remaining >= 0
    ? remaining
    : undefined;
}
