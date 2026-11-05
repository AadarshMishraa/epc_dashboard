import { describe, expect, it } from 'vitest';
import type { Clock } from '../clock.ts';
import {
  createContext,
  deriveContext,
  parseCorrelationId,
  parseTenantId,
  requireTenant,
  type CorrelationId,
  type TenantContext,
  type TenantId,
} from '../context.ts';
import { parseId, type Id } from '../ids.ts';
import { createAuditRecord, prepareAuditEntry } from './audit.ts';
import { classifyField, isClassification, type ClassificationLookup } from './classification.ts';
import { createEventEnvelope, prepareEvent } from './events.ts';
import { toFrozenJson } from './json.ts';
import { maskRecipient, prepareMessage } from './messages.ts';
import { isEraserHandlerId } from './erasure.ts';

const clock: Clock = { nowMillis: () => 1_700_000_000_000, monotonicMillis: () => 0 };
const id = (value: string): Id => parseId(value) as Id;
const TENANT_A = parseTenantId('0190f3e2-7a1b-7c3d-8e4f-0000000000a1') as TenantId;
const TENANT_B = parseTenantId('0190f3e2-7a1b-7c3d-8e4f-0000000000a2') as TenantId;
const USER = id('0190f3e2-7a1b-7c3d-8e4f-0000000000b1');
const RECORD = id('0190f3e2-7a1b-7c3d-8e4f-0000000000c1');
const CAUSE = id('0190f3e2-7a1b-7c3d-8e4f-0000000000d1');
const correlationId = parseCorrelationId('req-1') as CorrelationId;

function tenantContext(): TenantContext {
  const result = requireTenant(
    createContext({
      tenantId: TENANT_A,
      actor: { kind: 'user', userId: USER },
      correlationId,
      clock,
    }),
  );
  if (!result.ok) throw new Error('fixture context has no tenant');
  return result.value;
}

function deepFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(deepFrozen);
}

describe('toFrozenJson', () => {
  it('returns a deep, frozen copy', () => {
    const input = { a: [1, { b: 'x' }], c: null, d: true };
    const result = toFrozenJson(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(input);
    expect(result.value).not.toBe(input);
    expect(deepFrozen(result.value)).toBe(true);
    input.a.push(2);
    expect(result.value).toEqual({ a: [1, { b: 'x' }], c: null, d: true });
  });

  it('keeps a __proto__ key as data without changing the prototype', () => {
    const input = JSON.parse('{"__proto__": {"polluted": true}}') as unknown;
    const result = toFrozenJson(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.getPrototypeOf(result.value)).toBe(Object.prototype);
    expect(Object.keys(result.value as object)).toEqual(['__proto__']);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  const cyclic: Record<string, unknown> = {};
  cyclic['self'] = cyclic;
  let deep: unknown = 1;
  for (let i = 0; i < 100; i += 1) deep = [deep];
  const sparse: number[] = [];
  sparse[0] = 1;
  sparse[2] = 3;

  it.each([
    ['undefined', undefined, ''],
    ['a function', () => 1, ''],
    ['NaN', Number.NaN, ''],
    ['Infinity', Number.POSITIVE_INFINITY, ''],
    ['a bigint', 1n, ''],
    ['a symbol', Symbol('x'), ''],
    ['a Date', new Date(0), ''],
    ['a Map', new Map(), ''],
    ['a nested undefined', { a: { b: undefined } }, 'a.b'],
    ['a function in an array', [1, () => 2], '1'],
    ['a sparse array', sparse, '1'],
    ['a cycle', cyclic, 'self'],
    ['nesting deeper than 64 levels', deep, ''],
  ])('rejects %s', (_label, value, path) => {
    const result = toFrozenJson(value);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    if (path !== '') expect(result.error.fields[0]?.path).toBe(path);
  });
});

describe('prepareEvent and createEventEnvelope', () => {
  it('takes the tenant from the context, never from the payload', () => {
    const prepared = prepareEvent({
      name: 'invoice.issued',
      version: 1,
      payload: { tenantId: TENANT_B },
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const envelope = createEventEnvelope(tenantContext(), prepared.value, RECORD);
    expect(envelope.tenantId).toBe(TENANT_A);
    expect(envelope).toMatchObject({
      id: RECORD,
      name: 'invoice.issued',
      version: 1,
      correlationId,
      occurredAtMillis: clock.nowMillis(),
    });
    expect(deepFrozen(envelope)).toBe(true);
  });

  it('records causation and the initiating actor from a derived context', () => {
    const prepared = prepareEvent({ name: 'invoice.issued', version: 1, payload: {} });
    if (!prepared.ok) throw new Error('fixture event invalid');
    const derived = deriveContext(tenantContext(), {
      causationId: CAUSE,
      actor: { kind: 'system', process: 'scheduler' },
    });
    const envelope = createEventEnvelope(derived, prepared.value, RECORD);
    expect(envelope.causationId).toBe(CAUSE);
    expect(envelope.actor).toEqual({ kind: 'system', process: 'scheduler' });
    expect(envelope.initiatedBy).toEqual({ kind: 'user', userId: USER });
  });

  it.each([
    ['a name without a dot', { name: 'issued', version: 1, payload: {} }, 'name'],
    ['an upper-case name', { name: 'Invoice.Issued', version: 1, payload: {} }, 'name'],
    ['version 0', { name: 'invoice.issued', version: 0, payload: {} }, 'version'],
    ['a fractional version', { name: 'invoice.issued', version: 1.5, payload: {} }, 'version'],
    [
      'a non-JSON payload',
      { name: 'invoice.issued', version: 1, payload: { a: Number.NaN } },
      'payload.a',
    ],
  ])('rejects %s', (_label, input, path) => {
    const result = prepareEvent(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.fields.map((f) => f.path)).toContain(path);
  });
});

describe('prepareAuditEntry and createAuditRecord', () => {
  it('builds a frozen record carrying tenant, actor and correlation id from the context', () => {
    const target = { type: 'invoice', id: RECORD };
    const prepared = prepareAuditEntry({ action: 'invoice.issue', outcome: 'succeeded', target });
    if (!prepared.ok) throw new Error('fixture entry invalid');
    const record = createAuditRecord(tenantContext(), prepared.value, CAUSE);
    expect(record).toEqual({
      id: CAUSE,
      tenantId: TENANT_A,
      actor: { kind: 'user', userId: USER },
      correlationId,
      occurredAtMillis: clock.nowMillis(),
      action: 'invoice.issue',
      outcome: 'succeeded',
      target,
    });
    expect(deepFrozen(record)).toBe(true);
    expect(record.target).not.toBe(target);
  });

  it.each([
    ['an action without a dot', { action: 'issue', outcome: 'succeeded' }, 'action'],
    ['an unknown outcome', { action: 'invoice.issue', outcome: 'maybe' }, 'outcome'],
    [
      'a target id that is not an id',
      { action: 'invoice.issue', outcome: 'succeeded', target: { type: 'invoice', id: '1' } },
      'target.id',
    ],
    [
      'a target type that is not snake_case',
      { action: 'invoice.issue', outcome: 'succeeded', target: { type: 'Invoice', id: RECORD } },
      'target.type',
    ],
  ])('rejects %s', (_label, input, path) => {
    const result = prepareAuditEntry(input as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.fields.map((f) => f.path)).toContain(path);
  });
});

describe('prepareMessage', () => {
  const valid = {
    channel: 'email',
    to: 'ravi@example.com',
    template: 'invoice_reminder',
    purpose: 'billing',
    consentRef: 'consent-123',
  } as const;

  it('accepts a complete message and returns a frozen copy', () => {
    const result = prepareMessage(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(valid);
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it.each([
    ['no consent reference', { ...valid, consentRef: '' }, 'consentRef'],
    ['a blank consent reference', { ...valid, consentRef: '   ' }, 'consentRef'],
    ['a missing consent reference', { ...valid, consentRef: undefined }, 'consentRef'],
    ['no purpose', { ...valid, purpose: '' }, 'purpose'],
    ['an unknown channel', { ...valid, channel: 'fax' }, 'channel'],
    ['an invalid email address', { ...valid, to: 'not-an-address' }, 'to'],
    ['a phone number for email', { ...valid, to: '+919800000001' }, 'to'],
    ['a local phone number for SMS', { ...valid, channel: 'sms', to: '9800000001' }, 'to'],
    ['no template', { ...valid, template: '' }, 'template'],
    ['a non-string parameter', { ...valid, params: { amount: 5 } }, 'params.amount'],
  ])('rejects %s', (_label, input, path) => {
    const result = prepareMessage(input as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.fields.map((f) => f.path)).toContain(path);
  });

  it('does not echo the recipient in the error', () => {
    const result = prepareMessage({ ...valid, consentRef: '' });
    expect(JSON.stringify(result)).not.toContain('ravi@example.com');
  });
});

describe('maskRecipient', () => {
  it.each([
    ['email', 'ravi@example.com', 'r***@e***.com'],
    ['sms', '+919800001234', '***1234'],
    ['whatsapp', '+919800001234', '***1234'],
  ] as const)('masks a %s recipient', (channel, to, masked) => {
    expect(maskRecipient(channel, to)).toBe(masked);
  });
});

describe('classifyField', () => {
  const lookup = (classify: ClassificationLookup['classify']): ClassificationLookup => ({
    classify,
  });
  const field = { entity: 'customer', field: 'phone' };

  it('passes a valid classification through', () => {
    expect(
      classifyField(
        lookup(() => 'personal'),
        tenantContext(),
        field,
      ),
    ).toBe('personal');
  });

  it('treats a throw as secret and reports the cause', () => {
    const causes: unknown[] = [];
    const failure = new Error('cache cold');
    const result = classifyField(
      lookup(() => {
        throw failure;
      }),
      tenantContext(),
      field,
      (cause) => causes.push(cause),
    );
    expect(result).toBe('secret');
    expect(causes).toEqual([failure]);
  });

  it.each([undefined, null, '', 'PUBLIC', 'unknown'])('treats %s as secret', (value) => {
    expect(
      classifyField(
        lookup(() => value as never),
        tenantContext(),
        field,
      ),
    ).toBe('secret');
  });

  it('knows the five classes', () => {
    for (const value of ['public', 'internal', 'personal', 'sensitive_personal', 'secret']) {
      expect(isClassification(value)).toBe(true);
    }
    expect(isClassification('confidential')).toBe(false);
  });
});

describe('isEraserHandlerId', () => {
  it.each(['k8-files', 'k8-files.blobs', 'epc.customer_documents'])('accepts %s', (value) => {
    expect(isEraserHandlerId(value)).toBe(true);
  });

  it.each(['', 'K8', 'k8 files', '-x', 'x'.repeat(129)])('rejects %j', (value) => {
    expect(isEraserHandlerId(value)).toBe(false);
  });
});
