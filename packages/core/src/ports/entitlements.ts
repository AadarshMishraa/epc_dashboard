import type { TenantContext } from '../context.ts';

export type EntitlementDecision =
  | { readonly enabled: true }
  | { readonly enabled: false; readonly reason: 'UNKNOWN_KEY' | 'NOT_ENABLED' | 'GATE_FAILED' };

/** Whether the tenant's plan and enabled modules include a feature key. Implemented by K3. */
export interface EntitlementGate {
  check(context: TenantContext, key: string): Promise<EntitlementDecision>;
}

/** Asks the gate and fails closed: a throw or a malformed answer is `GATE_FAILED`. */
export async function checkEntitlement(
  gate: EntitlementGate,
  context: TenantContext,
  key: string,
): Promise<EntitlementDecision> {
  try {
    const decision: unknown = await gate.check(context, key);
    // Own properties only, so a polluted Object.prototype cannot enable anything.
    const own = (name: string): unknown =>
      typeof decision === 'object' && decision !== null && Object.hasOwn(decision, name)
        ? (decision as Record<string, unknown>)[name]
        : undefined;
    if (own('enabled') === true) return { enabled: true };
    const reason = own('reason');
    return reason === 'UNKNOWN_KEY' || reason === 'NOT_ENABLED'
      ? { enabled: false, reason }
      : { enabled: false, reason: 'GATE_FAILED' };
  } catch {
    return { enabled: false, reason: 'GATE_FAILED' };
  }
}
