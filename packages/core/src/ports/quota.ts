import type { TenantContext } from '../context.ts';

export type QuotaDecision =
  | { readonly granted: true; readonly remaining: number }
  | {
      readonly granted: false;
      readonly reason: 'UNKNOWN_QUOTA' | 'EXHAUSTED' | 'INVALID_AMOUNT' | 'QUOTA_FAILED';
      readonly retryAfterSeconds?: number;
    };

/**
 * Consumes from a tenant's limit (requests, records, storage). Unknown quotas are
 * exhausted, never unlimited; consumption is atomic, so concurrent callers never
 * overdraw. Values come from K3; enforcement points are in K1.
 */
export interface QuotaProvider {
  consume(context: TenantContext, quota: string, amount: number): Promise<QuotaDecision>;
}

/** Amounts are whole numbers of at least 1. */
export function isValidQuotaAmount(amount: number): boolean {
  return Number.isSafeInteger(amount) && amount >= 1;
}
