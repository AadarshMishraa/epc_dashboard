import {
  type AuditRecord,
  type AuditSink,
  type Clock,
  type EraserHandler,
  type EraserRegistry,
  type EventEnvelope,
  type EventPublisher,
  type MessageSender,
  type OutgoingMessage,
  type TenantId,
  coreError,
  err,
  ok,
} from '@gx/core';
import { describe, expect, it } from 'vitest';
import { frozenClock } from '../clock.ts';
import { tenantContext, testId, testTenant } from '../context.ts';

const A = testTenant(1);
const B = testTenant(2);

export interface AuditHarness {
  readonly sink: AuditSink;
  readonly records: (tenantId: TenantId) => Promise<readonly AuditRecord[]>;
}

export function auditSinkContract(
  name: string,
  make: (clock: Clock) => AuditHarness | Promise<AuditHarness>,
): void {
  describe(`${name}: AuditSink contract`, () => {
    const entry = {
      action: 'invoice.issue',
      resource: { type: 'invoice', id: testId(5) },
      outcome: 'success',
    } as const;

    it('stores who, where and when from the context, not from the entry', async () => {
      const clock = frozenClock(1_000);
      const { sink, records } = await make(clock);
      const initiatedBy = { kind: 'user', userId: testId(3) } as const;
      const result = await sink.append(
        tenantContext({ clock, actor: { kind: 'system', process: 'jobs' }, initiatedBy }),
        entry,
      );
      expect(result.ok).toBe(true);
      const [record] = await records(A);
      expect(record).toMatchObject({
        ...entry,
        tenantId: A,
        actor: { kind: 'system', process: 'jobs' },
        initiatedBy,
        correlationId: 'test-correlation',
        at: 1_000,
      });
      expect(result.ok && result.value.id).toBe(record?.id);
    });

    it('keeps tenants apart', async () => {
      const { sink, records } = await make(frozenClock());
      await sink.append(tenantContext(), entry);
      expect(await records(B)).toEqual([]);
    });

    it('cannot be changed after it is written', async () => {
      const { sink, records } = await make(frozenClock());
      await sink.append(tenantContext(), entry);
      const [first] = await records(A);
      try {
        (first as { outcome: string }).outcome = 'failure';
      } catch {
        // Frozen copies throw in strict mode; either way the stored record must not change.
      }
      expect((await records(A))[0]?.outcome).toBe('success');
    });
  });
}

export interface EventHarness {
  readonly publisher: EventPublisher;
  readonly published: (tenantId: TenantId) => Promise<readonly EventEnvelope[]>;
}

export function eventPublisherContract(
  name: string,
  make: (clock: Clock) => EventHarness | Promise<EventHarness>,
): void {
  describe(`${name}: EventPublisher contract`, () => {
    it('takes tenant and actor from the context even if the payload claims another tenant', async () => {
      const clock = frozenClock(5_000);
      const { publisher, published } = await make(clock);
      const result = await publisher.publish(tenantContext({ clock, causationId: testId(7) }), {
        type: 'invoice.issued',
        version: 1,
        payload: { tenantId: B, invoice: 'INV-1' },
      });
      expect(result.ok && result.value).toMatchObject({
        tenantId: A,
        actor: { kind: 'user', userId: testId(1) },
        correlationId: 'test-correlation',
        causationId: testId(7),
        occurredAt: 5_000,
        type: 'invoice.issued',
        version: 1,
      });
      expect(await published(B)).toEqual([]);
      expect(await published(A)).toHaveLength(1);
    });

    it('gives every event its own id', async () => {
      const { publisher, published } = await make(frozenClock());
      for (let i = 0; i < 50; i += 1)
        await publisher.publish(tenantContext(), {
          type: 'x.happened',
          version: 1,
          payload: { i },
        });
      expect(new Set((await published(A)).map((e) => e.id)).size).toBe(50);
    });

    it('is not affected by changes to the payload after publishing', async () => {
      const { publisher, published } = await make(frozenClock());
      const payload = { items: ['a'] };
      await publisher.publish(tenantContext(), { type: 'x.happened', version: 1, payload });
      payload.items.push('b');
      expect((await published(A))[0]?.payload).toEqual({ items: ['a'] });
    });
  });
}

export interface MessageHarness {
  readonly sender: MessageSender;
  readonly sent: (
    tenantId: TenantId,
  ) => Promise<readonly { readonly to: string; readonly messageId: string }[]>;
}

export function messageSenderContract(
  name: string,
  make: (clock: Clock) => MessageHarness | Promise<MessageHarness>,
): void {
  describe(`${name}: MessageSender contract`, () => {
    const message: OutgoingMessage = {
      channel: 'whatsapp',
      to: '+919876543210',
      template: 'payment_reminder_v1',
      params: { amount: '₹12,000' },
      purpose: 'payment_reminder',
      consentRef: 'consent:0190f3e2',
    };

    it.each([
      ['no consent reference', { consentRef: '' }],
      ['no purpose', { purpose: ' ' }],
      ['free text instead of a template id', { template: 'Hello, pay now!' }],
      ['no recipient', { to: '' }],
    ])('refuses to send with %s, and sends nothing', async (_label, change) => {
      const { sender, sent } = await make(frozenClock());
      const result = await sender.send(tenantContext(), { ...message, ...change });
      expect(!result.ok && result.error.code).toBe('VALIDATION_FAILED');
      expect(await sent(A)).toEqual([]);
    });

    it('sends a valid message and keeps the recipient masked', async () => {
      const { sender, sent } = await make(frozenClock());
      const result = await sender.send(tenantContext(), message);
      expect(result.ok).toBe(true);
      const [record] = await sent(A);
      expect(record?.to).not.toContain('98765');
      expect(record?.to.endsWith('10')).toBe(true);
      expect(await sent(B)).toEqual([]);
    });
  });
}

export function eraserRegistryContract(
  name: string,
  make: () => EraserRegistry | Promise<EraserRegistry>,
): void {
  describe(`${name}: EraserRegistry contract`, () => {
    const subject = { kind: 'person', id: testId(42) } as const;
    const handler = (module: string, entity: string, fail = false): EraserHandler => ({
      module,
      entity,
      erase: () =>
        Promise.resolve(fail ? err(coreError('INTERNAL')) : ok({ erased: 1, retained: 0 })),
      export: () => Promise.resolve(ok([{ module, entity }])),
    });

    it('fails, never succeeds, when no handlers are registered', async () => {
      const result = await (await make()).erase(tenantContext(), subject);
      expect(!result.ok && result.error.code).toBe('UNPROCESSABLE');
    });

    it('rejects a second handler for the same module and entity', async () => {
      const registry = await make();
      expect(registry.register(handler('parties', 'person')).ok).toBe(true);
      const again = registry.register(handler('parties', 'person'));
      expect(!again.ok && again.error.code).toBe('CONFLICT');
    });

    it('runs every handler and reports each outcome; one failure makes it incomplete', async () => {
      const registry = await make();
      registry.register(handler('parties', 'person'));
      registry.register(handler('billing', 'invoice', true));
      registry.register(handler('files', 'file'));
      const result = await registry.erase(tenantContext(), subject);
      expect(result.ok && result.value.complete).toBe(false);
      expect(result.ok && result.value.outcomes.map((o) => [o.module, o.result.ok])).toEqual([
        ['parties', true],
        ['billing', false],
        ['files', true],
      ]);
    });

    it('exports from every handler', async () => {
      const registry = await make();
      registry.register(handler('parties', 'person'));
      const result = await registry.export(tenantContext(), subject);
      expect(result.ok && result.value).toMatchObject({
        complete: true,
        outcomes: [{ module: 'parties' }],
      });
    });
  });
}
