import {
  coreError,
  err,
  maskAddress,
  ok,
  type AuditEntry,
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
    const entry: AuditEntry = {
      action: 'invoice.issue',
      resource: { type: 'invoice', id: testId(5) },
      outcome: 'success',
    };

    it('stores who, where and when from the context', async () => {
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

    it('ignores who, where and when smuggled into the entry (repudiation)', async () => {
      const clock = frozenClock(2_000);
      const { sink, records } = await make(clock);
      const spoofed = {
        ...entry,
        tenantId: B,
        actor: { kind: 'operator', operatorId: testId(66), supportSessionId: testId(67) },
        initiatedBy: { kind: 'operator', operatorId: testId(66), supportSessionId: testId(67) },
        correlationId: 'forged',
        id: testId(99),
        at: 0,
        extra: 'smuggled',
      } as unknown as AuditEntry;
      const result = await sink.append(tenantContext({ clock }), spoofed);
      const [record] = await records(A);
      expect(record).toMatchObject({
        tenantId: A,
        actor: { kind: 'user', userId: testId(1) },
        correlationId: 'test-correlation',
        at: 2_000,
      });
      expect(record?.id).toBe(result.ok ? result.value.id : undefined);
      expect(record?.id).not.toBe(testId(99));
      expect(record && 'initiatedBy' in record).toBe(false);
      expect(record && 'extra' in record).toBe(false);
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
  readonly sent: (tenantId: TenantId) => Promise<readonly object[]>;
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
      params: { customer_name: 'Asha Verma', amount: '₹12,000' },
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

    it('stores the recipient fully masked and no parameter values or extra fields', async () => {
      const { sender, sent } = await make(frozenClock());
      const smuggled = { ...message, rawTo: message.to } as OutgoingMessage;
      expect((await sender.send(tenantContext(), smuggled)).ok).toBe(true);
      const [record] = await sent(A);
      expect((record as { to?: unknown }).to).toBe(maskAddress(message.to));
      const stored = JSON.stringify(record);
      for (const leak of ['98765', '9876543210', 'Asha', '12,000', 'rawTo'])
        expect(stored).not.toContain(leak);
      expect(await sent(B)).toEqual([]);
    });
  });
}

export function eraserRegistryContract(
  name: string,
  make: (options: {
    readonly handlerTimeoutMs: number;
  }) => EraserRegistry | Promise<EraserRegistry>,
): void {
  describe(`${name}: EraserRegistry contract`, () => {
    const subject = { kind: 'person', id: testId(42) } as const;
    const handler = (
      module: string,
      entity: string,
      erase?: EraserHandler['erase'],
    ): EraserHandler => ({
      module,
      entity,
      erase: erase ?? (() => Promise.resolve(ok({ erased: 1, retained: 0 }))),
      export: () => Promise.resolve(ok([{ module, entity }])),
    });
    const registry = () => make({ handlerTimeoutMs: 50 });

    it('fails, never succeeds, when no handlers are registered', async () => {
      const result = await (await registry()).erase(tenantContext(), subject);
      expect(!result.ok && result.error.code).toBe('NO_HANDLERS');
    });

    it('rejects a second handler for the same module and entity', async () => {
      const r = await registry();
      expect(r.register(handler('parties', 'person')).ok).toBe(true);
      const again = r.register(handler('parties', 'person'));
      expect(!again.ok && again.error.code).toBe('CONFLICT');
    });

    it('is complete only when every handler succeeds', async () => {
      const r = await registry();
      r.register(handler('parties', 'person'));
      const result = await r.erase(tenantContext(), subject);
      expect(result.ok && result.value.outcomes.map((o) => o.module)).toEqual(['parties']);
    });

    it('returns an error, not ok, when one handler fails, and still runs the others', async () => {
      const r = await registry();
      r.register(handler('parties', 'person'));
      r.register(handler('billing', 'invoice', () => Promise.resolve(err(coreError('INTERNAL')))));
      r.register(handler('files', 'file'));
      const result = await r.erase(tenantContext(), subject);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.code).toBe('INCOMPLETE');
      expect(!result.ok && result.error.outcomes.map((o) => [o.module, o.result.ok])).toEqual([
        ['parties', true],
        ['billing', false],
        ['files', true],
      ]);
    });

    it('does not let a handler that never answers block the rest', async () => {
      const r = await registry();
      r.register(handler('stuck', 'thing', () => new Promise(() => undefined)));
      r.register(handler('parties', 'person'));
      const started = performance.now();
      const result = await r.erase(tenantContext(), subject);
      expect(performance.now() - started).toBeLessThan(2_000);
      expect(!result.ok && result.error.outcomes.map((o) => [o.module, o.result.ok])).toEqual([
        ['stuck', false],
        ['parties', true],
      ]);
    });

    it('counts a malformed handler answer as a failure, not a success', async () => {
      const r = await registry();
      r.register(handler('odd', 'thing', () => Promise.resolve({ ok: 'yes' } as never)));
      const result = await r.erase(tenantContext(), subject);
      expect(!result.ok && result.error.code).toBe('INCOMPLETE');
    });

    it('counts an ok answer without a value as a failure', async () => {
      const r = await registry();
      r.register(handler('odd', 'thing', () => Promise.resolve({ ok: true } as never)));
      const result = await r.erase(tenantContext(), subject);
      expect(!result.ok && result.error.code).toBe('INCOMPLETE');
    });

    it('exports from every handler', async () => {
      const r = await registry();
      r.register(handler('parties', 'person'));
      const result = await r.export(tenantContext(), subject);
      expect(result.ok && result.value.outcomes.map((o) => o.module)).toEqual(['parties']);
    });
  });
}
