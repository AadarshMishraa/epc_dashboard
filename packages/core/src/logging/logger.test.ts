import { describe, expect, it } from 'vitest';
import type { Clock } from '../clock.ts';
import {
  createContext,
  parseAiClientId,
  parseCorrelationId,
  parseTenantId,
  type Actor,
  type AiClientId,
  type Context,
  type CorrelationId,
  type TenantId,
} from '../context.ts';
import { coreError } from '../errors.ts';
import { parseId, type Id } from '../ids.ts';
import type { Classification, ClassificationLookup, FieldRef } from '../ports/classification.ts';
import { Secret } from '../ports/secret.ts';
import { createLogger, LOG_LEVELS, type LoggerOptions, type LogSink } from './logger.ts';

// Seeded personal data is synthetic: test-range phone numbers and example.com addresses.
const id = (value: string): Id => parseId(value) as Id;
const TENANT = parseTenantId('0190f3e2-7a1b-7c3d-8e4f-0000000000a1') as TenantId;
const OTHER_TENANT = parseTenantId('0190f3e2-7a1b-7c3d-8e4f-0000000000a2') as TenantId;
const USER = id('0190f3e2-7a1b-7c3d-8e4f-0000000000b1');
const EVENT_ID = id('0190f3e2-7a1b-7c3d-8e4f-0000000000c1');
const correlationId = parseCorrelationId('req-1') as CorrelationId;
const clock: Clock = { nowMillis: () => Date.UTC(2026, 10, 5, 6, 30), monotonicMillis: () => 0 };
const user: Actor = { kind: 'user', userId: USER };
const PII = /9876543210|98765 43210|ravi|ABCPK1234F/;

function context(overrides: Partial<Parameters<typeof createContext>[0]> = {}): Context {
  return createContext({ tenantId: TENANT, actor: user, correlationId, clock, ...overrides });
}

class MemorySink implements LogSink {
  readonly lines: string[] = [];
  write(line: string): void {
    this.lines.push(line);
  }
  records(): Record<string, unknown>[] {
    return this.lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  }
  last(): Record<string, unknown> {
    const line = this.lines.at(-1);
    if (line === undefined) throw new Error('nothing logged');
    return JSON.parse(line) as Record<string, unknown>;
  }
}

/** A lookup over a fixed table; anything else is secret, as the port requires. */
function lookup(table: Readonly<Record<string, Classification>>): ClassificationLookup {
  return {
    classify: (_context: Context, field: FieldRef) =>
      table[`${field.entity}.${field.field}`] ?? 'secret',
  };
}

function setup(options: Partial<LoggerOptions> = {}, ctx: Context = context()) {
  const sink = new MemorySink();
  const failures: unknown[] = [];
  const logger = createLogger(ctx, {
    sink,
    onFailure: (cause) => failures.push(cause),
    ...options,
  });
  return { sink, failures, logger };
}

describe('createLogger: line shape', () => {
  it('writes one JSON line with time, level, event, tenant, correlation and actor', () => {
    const { sink, logger } = setup();
    logger.info('invoice.issued', { invoice: 'INV-1042', amount_paise: 125_000 });
    expect(sink.lines).toHaveLength(1);
    expect(sink.last()).toEqual({
      ts: '2026-11-05T06:30:00.000Z',
      level: 'info',
      event: 'invoice.issued',
      tenant_id: TENANT,
      correlation_id: 'req-1',
      actor: { kind: 'user', id: USER },
      fields: { invoice: 'INV-1042', amount_paise: 125_000 },
    });
  });

  it('carries causation id and initiating actor when the context has them', () => {
    const system: Actor = { kind: 'system', process: 'scheduler' };
    const { sink, logger } = setup(
      {},
      context({ actor: system, initiatedBy: user, causationId: EVENT_ID }),
    );
    logger.warn('job.retried');
    expect(sink.last()).toMatchObject({
      causation_id: EVENT_ID,
      actor: { kind: 'system', process: 'scheduler' },
      initiated_by: { kind: 'user', id: USER },
      fields: {},
    });
  });

  it('describes every actor kind by id only', () => {
    const actors: Actor[] = [
      { kind: 'service_account', serviceAccountId: USER },
      { kind: 'operator', operatorId: USER, supportSessionId: EVENT_ID },
      { kind: 'anonymous' },
    ];
    const described = actors.map((actor) => {
      const { sink, logger } = setup({}, context({ actor }));
      logger.info('a.b');
      return sink.last()['actor'];
    });
    expect(described).toEqual([
      { kind: 'service_account', id: USER },
      { kind: 'operator', id: USER, support_session: EVENT_ID },
      { kind: 'anonymous' },
    ]);
  });

  it('backstops an AI client id, which may be a URL with secrets in its query', () => {
    const clientId = parseAiClientId('https://agent.example/cb?key=leakme') as AiClientId;
    const actor: Actor = {
      kind: 'user',
      userId: USER,
      via: { kind: 'ai_client', clientId, scopes: ['read'] },
    };
    const { sink, logger } = setup({}, context({ actor }));
    logger.info('a.b');
    expect(sink.last()['actor']).toEqual({
      kind: 'user',
      id: USER,
      via: { kind: 'ai_client', id: 'https://agent.example/cb?key=[redacted]', scopes: ['read'] },
    });
  });

  it('backstops a correlation id that bypassed parseCorrelationId', () => {
    expect(parseCorrelationId('9876543210')).toBeUndefined();
    const phoneShaped = '9876543210' as CorrelationId;
    const { sink, logger } = setup({}, context({ correlationId: phoneShaped }));
    logger.info('a.b');
    expect(sink.last()['correlation_id']).toBe('[phone]');
  });

  it('omits tenant_id for a context without a tenant, never inventing one', () => {
    const { sink, logger } = setup({}, createContext({ actor: user, correlationId, clock }));
    logger.info('platform.started');
    expect(sink.last()).not.toHaveProperty('tenant_id');
  });

  it('replaces an event that is not a dotted snake_case key', () => {
    const { sink, logger } = setup();
    for (const event of ['Invoice Issued', 'a..b', '', 'x'.repeat(41), 'call 9876543210']) {
      logger.info(event);
    }
    expect(sink.records().map((record) => record['event'])).toEqual(
      Array.from({ length: 5 }, () => 'log.invalid_event'),
    );
  });

  it('drops levels below minLevel (info by default)', () => {
    const quiet = setup();
    quiet.logger.debug('a.b');
    expect(quiet.sink.lines).toHaveLength(0);
    const strict = setup({ minLevel: 'warn' });
    for (const level of LOG_LEVELS) strict.logger[level]('a.b');
    expect(strict.sink.records().map((record) => record['level'])).toEqual(['warn', 'error']);
  });
});

describe('createLogger: F-02-AC1 traceability', () => {
  it('puts tenant, actor and correlation id on 50 sampled lines across levels and contexts', () => {
    const sink = new MemorySink();
    const contexts = [
      context(),
      context({
        tenantId: OTHER_TENANT,
        correlationId: parseCorrelationId('job-7') as CorrelationId,
      }),
      context({ actor: { kind: 'system', process: 'outbox' }, causationId: EVENT_ID }),
    ];
    const loggers = contexts.map((ctx) => createLogger(ctx, { sink, minLevel: 'debug' }));
    for (let index = 0; index < 50; index += 1) {
      const logger = loggers[index % loggers.length];
      const level = LOG_LEVELS[index % LOG_LEVELS.length];
      if (logger === undefined || level === undefined) throw new Error('bad sample');
      logger[level]('sample.line', { index, note: 'payload says tenant_id=x' });
    }
    const records = sink.records();
    expect(records).toHaveLength(50);
    records.forEach((record, index) => {
      const expected = contexts[index % contexts.length];
      expect(record['tenant_id']).toBe(expected?.tenantId);
      expect(record['correlation_id']).toBe(expected?.correlationId);
      expect(record['actor']).toHaveProperty('kind', expected?.actor.kind);
    });
  });
});

describe('createLogger: F-02-AC3 masking', () => {
  it('masks phone, email and id values in fields, keys, nested values and errors', () => {
    const { sink, logger } = setup();
    logger.error('lead.import_failed', {
      note: 'customer Ravi +91 98765 43210 wrote from ravi@example.com', // privacycheck:ignore
      row: { reference: 'ABCPK1234F', contact: ['9876543210'] },
      'ravi@example.com': 'as a key',
      error: coreError('VALIDATION_FAILED', {
        detail: 'row 4 has 9876543210',
        cause: Object.assign(new Error('Key (phone)=(9876543210)'), { code: '23505' }),
      }),
    });
    const line = sink.lines.at(-1) ?? '';
    expect(line).not.toMatch(PII);
    expect(line).toContain('[phone]');
    expect(line).toContain('[email]');
    expect(line).toContain('[pan]');
    expect(line).toContain('"cause":{"type":"Error","code":"23505"}');
  });
});

describe('createLogger: classification', () => {
  const classification = lookup({
    'lead.phone': 'personal',
    'lead.health_note': 'sensitive_personal',
    'lead.otp': 'secret',
    'lead.status': 'internal',
    'lead.city': 'public',
  });

  it('masks personal, removes sensitive and secret, and backstops the rest', () => {
    const { sink, logger } = setup({ classification });
    logger.info(
      'lead.updated',
      {
        phone: '9876543210',
        health_note: 'diabetic',
        otp: '123456',
        status: 'called 9876543210',
        city: 'Pune',
        unlisted: 'anything',
      },
      { entity: 'lead' },
    );
    expect(sink.last()['fields']).toEqual({
      phone: '[personal]',
      health_note: '[redacted]',
      otp: '[redacted]',
      status: 'called [phone]',
      city: 'Pune',
      unlisted: '[redacted]',
    });
  });

  it('treats every field as secret when an entity is named but no lookup is set', () => {
    const { sink, logger } = setup();
    logger.info('lead.updated', { city: 'Pune', status: 'new' }, { entity: 'lead' });
    expect(sink.last()['fields']).toEqual({ city: '[redacted]', status: '[redacted]' });
  });

  it('fails closed and reports when the lookup throws or answers nonsense', () => {
    const failure = new Error('lookup down');
    const throwing: ClassificationLookup = {
      classify: () => {
        throw failure;
      },
    };
    const { sink, failures, logger } = setup({ classification: throwing });
    logger.info('lead.updated', { city: 'Pune' }, { entity: 'lead' });
    expect(sink.last()['fields']).toEqual({ city: '[redacted]' });
    expect(failures).toEqual([failure]);

    const nonsense: ClassificationLookup = { classify: () => 'PUBLIC' as Classification };
    const second = setup({ classification: nonsense });
    second.logger.info('lead.updated', { city: 'Pune' }, { entity: 'lead' });
    expect(second.sink.last()['fields']).toEqual({ city: '[redacted]' });
  });

  it('asks the lookup with the logger context and the entity and field names', () => {
    const asked: string[] = [];
    const recording: ClassificationLookup = {
      classify: (ctx, field) => {
        asked.push(`${String(ctx.tenantId)}:${field.entity}.${field.field}`);
        return 'public';
      },
    };
    const { logger } = setup({ classification: recording });
    logger.info('lead.updated', { a: 1, b: 2 }, { entity: 'lead' });
    expect(asked).toEqual([`${TENANT}:lead.a`, `${TENANT}:lead.b`]);
  });

  it('does not classify a call that names no entity', () => {
    let calls = 0;
    const counting: ClassificationLookup = {
      classify: () => {
        calls += 1;
        return 'public';
      },
    };
    const { sink, logger } = setup({ classification: counting });
    logger.info('a.b', { city: 'Pune' });
    expect(calls).toBe(0);
    expect(sink.last()['fields']).toEqual({ city: 'Pune' });
  });
});

describe('createLogger: tampering', () => {
  it('keeps a forged payload inside fields, on one line, with control characters escaped', () => {
    const { sink, logger } = setup();
    const esc = String.fromCharCode(27);
    logger.info('a.b', {
      correlation_id: 'evil',
      level: 'error',
      tenant_id: OTHER_TENANT,
      note: `ok\n{"level":"error","correlation_id":"evil"}\r\n${esc}[31mred`,
      [`k\n${esc}`]: 'v',
    });
    expect(sink.lines).toHaveLength(1);
    const line = sink.lines[0] ?? '';
    expect(line).not.toMatch(/[\n\r]/);
    expect(line).not.toContain(esc);
    const record = sink.last();
    expect(record['correlation_id']).toBe('req-1');
    expect(record['level']).toBe('info');
    expect(record['tenant_id']).toBe(TENANT);
  });

  it('escapes the Unicode line and paragraph separators', () => {
    const { sink, logger } = setup();
    const separators = `${String.fromCharCode(0x2028)}x${String.fromCharCode(0x2029)}`;
    logger.info('a.b', { note: separators });
    const line = sink.lines[0] ?? '';
    expect(line).not.toContain(String.fromCharCode(0x2028));
    expect(line).not.toContain(String.fromCharCode(0x2029));
    // The backstop folds every whitespace character to a plain space before matching.
    expect(sink.last()['fields']).toEqual({ note: ' x ' });
  });

  it('never reads a polluted Object.prototype into a line', () => {
    const proto = Object.prototype as Record<string, unknown>;
    proto['polluted'] = '9876543210';
    try {
      const { sink, logger } = setup();
      logger.info('a.b', { a: 1 });
      expect(sink.lines[0]).not.toContain('polluted');
    } finally {
      delete proto['polluted'];
    }
  });
});

describe('createLogger: limits', () => {
  it('drops fields from a line that is too long and says so', () => {
    const { sink, logger } = setup({ maxLineChars: 2_000 });
    // The walk stops at the budget first; a line can still be too long through JSON escapes.
    const control = String.fromCharCode(1);
    logger.info(
      'a.b',
      Object.fromEntries(
        Array.from({ length: 4 }, (_, i) => [`k${String(i)}`, control.repeat(300)]),
      ),
    );
    expect(sink.last()).toMatchObject({
      fields: {},
      fields_dropped: 'line_too_long',
      correlation_id: 'req-1',
    });
    expect(sink.lines[0]?.length).toBeLessThanOrEqual(2_000);
  });

  it('never lets maxLineChars go so low that the header itself is dropped', () => {
    const { sink, logger } = setup({ maxLineChars: 1 });
    logger.info('a.b', { a: 'b' });
    expect(sink.last()).toMatchObject({ event: 'a.b', fields: { a: 'b' } });
  });

  it('classifies at most the breadth limit of fields and counts the rest', () => {
    let calls = 0;
    const counting: ClassificationLookup = {
      classify: () => {
        calls += 1;
        return 'public';
      },
    };
    const { sink, logger } = setup({ classification: counting });
    const fields = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`k${String(i)}`, i]));
    logger.info('a.b', fields, { entity: 'lead' });
    expect(calls).toBe(50);
    expect(Object.keys(sink.last()['fields'] as object)).toHaveLength(50);
    expect(sink.last()['fields_omitted']).toBe(30);
  });
});

describe('createLogger: failures never throw and never lose the line', () => {
  it('writes [getter] for a top-level getter without invoking it', () => {
    let calls = 0;
    const fields = Object.defineProperty({}, 'note', {
      enumerable: true,
      get: () => {
        calls += 1;
        return '9876543210';
      },
    });
    const { sink, logger } = setup();
    logger.info('a.b', fields);
    expect(calls).toBe(0);
    expect(sink.last()['fields']).toEqual({ note: '[getter]' });
  });

  it('writes a fallback line with ids and no payload when the fields are a revoked Proxy', () => {
    const { proxy, revoke } = Proxy.revocable({ phone: '9876543210' }, {});
    revoke();
    const { sink, failures, logger } = setup();
    logger.error('lead.failed', { nested: proxy });
    expect(sink.last()).toEqual({
      ts: '2026-11-05T06:30:00.000Z',
      level: 'error',
      event: 'lead.failed',
      tenant_id: TENANT,
      correlation_id: 'req-1',
      redaction_failed: true,
    });
    expect(failures).toHaveLength(1);
    expect(sink.lines[0]).not.toMatch(PII);
  });

  it('writes a fallback line when the clock breaks', () => {
    const broken: Clock = { nowMillis: () => Number.NaN, monotonicMillis: () => 0 };
    const { sink, failures, logger } = setup({}, context({ clock: broken }));
    logger.info('a.b', { contact: '9876543210' });
    expect(sink.last()).toMatchObject({ event: 'a.b', redaction_failed: true });
    expect(sink.lines[0]).not.toMatch(PII);
    expect(failures).toHaveLength(1);
  });

  it('reports a sink that throws instead of throwing itself', () => {
    const failure = new Error('stdout closed');
    const failures: unknown[] = [];
    const logger = createLogger(context(), {
      sink: {
        write: () => {
          throw failure;
        },
      },
      onFailure: (cause) => failures.push(cause),
    });
    expect(() => {
      logger.info('a.b');
    }).not.toThrow();
    expect(failures).toEqual([failure]);
  });

  it('survives an onFailure handler that throws too', () => {
    const logger = createLogger(context(), {
      sink: {
        write: () => {
          throw new Error('sink');
        },
      },
      onFailure: () => {
        throw new Error('handler');
      },
    });
    expect(() => {
      logger.info('a.b');
    }).not.toThrow();
  });

  it('logs an Error passed as the fields as one summarised value', () => {
    const { sink, logger } = setup();
    const error = Object.assign(new Error('dup 9876543210'), {
      code: '23505',
      detail: 'Key (phone)=(9876543210)',
    });
    logger.error('db.failed', error as never);
    expect(sink.last()['fields']).toEqual({ value: { type: 'Error', code: '23505' } });
  });

  it('prints a Secret in fields as [secret]', () => {
    const { sink, logger } = setup();
    logger.info('a.b', { key: new Secret('very-secret') });
    expect(sink.lines[0]).not.toContain('very-secret');
    expect(sink.last()['fields']).toEqual({ key: '[secret]' });
  });

  it('returns a frozen logger', () => {
    expect(Object.isFrozen(setup().logger)).toBe(true);
  });
});

describe('createLogger: cost and inputs', () => {
  it('logs a huge object, Map and Set within the budget and the line limit', () => {
    const { sink, logger } = setup();
    const huge = Object.fromEntries(
      Array.from({ length: 100_000 }, (_, i) => [`k${String(i)}`, '9876543210']),
    );
    const map = new Map(Array.from({ length: 100_000 }, (_, i) => [i, 'ravi@example.com']));
    const set = new Set(
      Array.from({ length: 100_000 }, (_, i) => `98765${String(i).padStart(5, '0')}`),
    );
    const started = performance.now();
    logger.info('bulk.import', { huge, map, set });
    expect(performance.now() - started).toBeLessThan(250);
    const line = sink.lines[0] ?? '';
    expect(line.length).toBeLessThanOrEqual(16_384);
    expect(line).not.toMatch(PII);
  });

  it('never mutates the caller’s fields and accepts frozen ones', () => {
    const fields = Object.freeze({
      note: 'call 9876543210',
      nested: Object.freeze({ email: 'ravi@example.com' }),
    });
    const before = JSON.stringify(fields);
    const { sink, logger } = setup();
    logger.info('a.b', fields);
    expect(JSON.stringify(fields)).toBe(before);
    expect(sink.last()['fields']).toEqual({
      note: 'call [phone]',
      nested: { email: '[personal]' },
    });
  });
});

// Security review of K0-T04 (2026-11-05).
describe('createLogger: review findings', () => {
  it('rejects an event key that holds a value the backstop would mask (L3)', () => {
    const { sink, logger } = setup();
    logger.info('lead.9876543210');
    logger.info('job.12345678901');
    expect(sink.records().map((record) => record['event'])).toEqual([
      'log.invalid_event',
      'log.invalid_event',
    ]);
  });

  it('escapes C1 controls, bidirectional overrides and zero-width marks (L4)', () => {
    const unsafe = [0x7f, 0x9b, 0x061c, 0x200b, 0x200e, 0x202e, 0x2066, 0x2069, 0xfeff].map(
      (code) => String.fromCharCode(code),
    );
    const { sink, logger } = setup();
    logger.info('a.b', { note: `ok${unsafe.join('')}done` });
    const line = sink.lines[0] ?? '';
    for (const char of unsafe) expect(line).not.toContain(char);
    // Format characters are removed by the backstop; DEL and C1 controls are escaped.
    expect(line).toContain('\\u009b');
    expect(sink.last()['fields']).toEqual({ note: `ok${unsafe.slice(0, 2).join('')}done` });
  });

  it('writes a constant last-resort line with the level when the context itself throws (L5)', () => {
    const broken = {
      ...context(),
      get correlationId(): CorrelationId {
        throw new Error('broken context');
      },
    } as Context;
    const { sink, failures, logger } = setup({}, broken);
    logger.warn('a.b', { contact: '9876543210' });
    expect(sink.lines).toEqual([
      '{"level":"warn","event":"log.redaction_failed","redaction_failed":true}',
    ]);
    expect(failures).toHaveLength(1);
  });

  it('honours a classification over the personal-key backstop at the top level', () => {
    const { sink, logger } = setup({ classification: lookup({ 'product.name': 'public' }) });
    logger.info('product.updated', { name: 'Panel 540W' }, { entity: 'product' });
    logger.info('product.updated', { name: 'Panel 540W' });
    expect(sink.records().map((record) => record['fields'])).toEqual([
      { name: 'Panel 540W' },
      { name: '[personal]' },
    ]);
  });

  it('logs numbers that look like a phone or national id masked (H1)', () => {
    const { sink, logger } = setup();
    logger.info('lead.imported', { contact: 9876543210, amount_paise: 9876543210 });
    expect(sink.last()['fields']).toEqual({ contact: '[phone]', amount_paise: 9876543210 });
  });

  it('stops a huge nested payload at the line budget instead of walking all of it (M2)', () => {
    let node: unknown = 'leaf';
    for (let level = 0; level < 5; level += 1) node = Array.from({ length: 50 }, () => node);
    const { sink, logger } = setup();
    const started = performance.now();
    logger.info('request.received', { payload: node });
    expect(performance.now() - started).toBeLessThan(200);
    const line = sink.lines[0] ?? '';
    expect(line.length).toBeLessThanOrEqual(16_384);
    expect(line).toContain('[budget exceeded]');
    expect(sink.last()).not.toHaveProperty('fields_dropped');
  });
});
