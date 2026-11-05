import type { TenantContext } from '../context.ts';
import { settleDecision, type Decision, type DenyOnError } from './decision.ts';

export const ENTITLEMENT_DENIALS = Object.freeze(['UNKNOWN_KEY', 'NOT_ENTITLED'] as const);
export type EntitlementDenial = (typeof ENTITLEMENT_DENIALS)[number];
export type EntitlementDecision = Decision<EntitlementDenial> | DenyOnError;

/**
 * Whether the tenant's plan includes a feature or module. A key the gate does not know is
 * denied, never treated as included. Implemented by K3; call it through `checkEntitlement`.
 */
export interface EntitlementGate {
  check(context: TenantContext, key: string): Promise<Decision<EntitlementDenial>>;
}

/** Asks the gate and fails closed: a throw or a malformed answer is a denial. */
export function checkEntitlement(
  gate: EntitlementGate,
  context: TenantContext,
  key: string,
): Promise<EntitlementDecision> {
  return settleDecision(ENTITLEMENT_DENIALS, () => gate.check(context, key));
}
