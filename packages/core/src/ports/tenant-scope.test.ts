import { describe, expect, it } from 'vitest';
import type { Context } from '../context.ts';
import type { AuditSink } from './audit.ts';
import type { Authorizer } from './authorizer.ts';
import type { EntitlementGate } from './entitlements.ts';
import type { EraserRegistry } from './erasure.ts';
import type { EventPublisher } from './events.ts';
import type { MessageSender } from './messages.ts';
import type { QuotaProvider } from './quotas.ts';
import type { TenantSecretsProvider } from './secrets.ts';

// Compile-time checks, run by `pnpm typecheck`: every tenant-scoped port method refuses a
// plain Context, so a caller must go through requireTenant first. Each line fails to compile
// if the port ever widens its parameter to Context; the unused-directive error proves it.
function tenantScopedMethodsRejectAPlainContext(
  context: Context,
  ports: {
    authorizer: Authorizer;
    gate: EntitlementGate;
    quotas: QuotaProvider;
    secrets: TenantSecretsProvider;
    audit: AuditSink;
    events: EventPublisher;
    messages: MessageSender;
    erasers: EraserRegistry;
  },
): void {
  // @ts-expect-error Authorizer.check needs a TenantContext
  void ports.authorizer.check(context, { permission: 'invoice.read' });
  // @ts-expect-error EntitlementGate.check needs a TenantContext
  void ports.gate.check(context, 'module.invoicing');
  // @ts-expect-error QuotaProvider.consume needs a TenantContext
  void ports.quotas.consume(context, { quota: 'api.calls', amount: 1, idempotencyKey: 'k' });
  // @ts-expect-error TenantSecretsProvider.get needs a TenantContext
  void ports.secrets.get(context, 'SMTP_PASSWORD');
  // @ts-expect-error AuditSink.append needs a TenantContext
  void ports.audit.append(context, { action: 'invoice.issue', outcome: 'succeeded' });
  // @ts-expect-error EventPublisher.publish needs a TenantContext
  void ports.events.publish(context, { name: 'invoice.issued', version: 1, payload: {} });
  // @ts-expect-error MessageSender.send needs a TenantContext
  void ports.messages.send(context, {
    channel: 'email',
    to: 'a@example.com',
    template: 'welcome',
    purpose: 'onboarding',
    consentRef: 'consent-1',
  });
  // @ts-expect-error EraserRegistry.erase needs a TenantContext
  void ports.erasers.erase(context, { subjectId: '' as never });
}

describe('tenant-scoped ports', () => {
  it('are checked by the compiler (see the @ts-expect-error lines in this file)', () => {
    expect(typeof tenantScopedMethodsRejectAPlainContext).toBe('function');
  });
});
