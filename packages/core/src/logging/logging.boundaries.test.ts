import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Clock } from '../clock.ts';
import {
  createContext,
  parseCorrelationId,
  parseTenantId,
  type Actor,
  type Context,
  type CorrelationId,
  type TenantId,
} from '../context.ts';
import { coreError } from '../errors.ts';
import { parseId, type Id } from '../ids.ts';
import type { ClassificationLookup } from '../ports/classification.ts';
import { summariseError } from './error-summary.ts';
import {
  LOG_MAX_FIELDS,
  LOG_MAX_LINE_BYTES,
  classified,
  createLogger,
  type LogData,
  type LogFields,
} from './logger.ts';
import { SCRUB_MAX_INPUT_LENGTH, SCRUB_MAX_OUTPUT_LENGTH, scrubText } from './scrub.ts';

// Limits and generated inputs for K0-T04 (threat model docs/security/threat-models/K0-T04-logging.md).

const clock: Clock = { nowMillis: () => 0, monotonicMillis: () => 0 };
const TENANT_A = parseTenantId('0190f3e2-7a1b-7c3d-8e4f-0000000000a1') as TenantId;
const TENANT_B = parseTenantId('0190f3e2-7a1b-7c3d-8e4f-0000000000a2') as TenantId;
const USER = parseId('0190f3e2-7a1b-7c3d-8e4f-0000000000b1') as Id;
const lookup: ClassificationLookup = { classify: () => 'internal' };

function contextFor(tenantId: TenantId, correlation = 'req-1', actor?: Actor): Context {
  return createContext({
    tenantId,
    actor: actor ?? { kind: 'user', userId: USER },
    correlationId: parseCorrelationId(correlation) as CorrelationId,
    clock,
  });
}

interface Parsed {
  readonly event: string;
  readonly correlation_id: string;
  readonly tenant_id: string | null;
  readonly actor: Readonly<Record<string, unknown>>;
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly problems?: Readonly<Record<string, unknown>>;
}

function write(data?: LogData, ctx: Context = contextFor(TENANT_A), event = 'job.updated'): Parsed {
  const lines: string[] = [];
  createLogger({ sink: (line) => lines.push(line), classification: lookup }).info(ctx, event, data);
  expect(lines).toHaveLength(1);
  return JSON.parse(lines[0] ?? '') as Parsed;
}

const digitsOf = (text: string): string => text.replace(/\D/g, '');

describe('limits: scrubText', () => {
  it('has the limits the threat model states', () => {
    expect(SCRUB_MAX_INPUT_LENGTH).toBe(2_048);
    expect(SCRUB_MAX_OUTPUT_LENGTH).toBe(1_024);
    expect(LOG_MAX_FIELDS).toBe(64);
    expect(LOG_MAX_LINE_BYTES).toBe(8_192);
  });

  it('keeps 7 digits and masks 8', () => {
    expect(scrubText('ref 1234567')).toBe('ref 1234567');
    expect(scrubText('ref 12345678')).toBe('ref [number]');
    expect(scrubText('ref 1234-567')).toBe('ref 1234-567');
    expect(scrubText('ref 1234-5678')).toBe('ref [number]');
  });

  it('joins digits across up to 3 separators and not across 4', () => {
    expect(scrubText('98765 - 43210')).toBe('[number]');
    expect(scrubText('98765 -- 43210')).toBe('98765 -- 43210');
  });

  it('scans a string of exactly the input cap and refuses one character more', () => {
    const atCap = `${'a'.repeat(SCRUB_MAX_INPUT_LENGTH - 10)}9876543210`;
    expect(scrubText(atCap)).not.toBe('[omitted:too_long]');
    expect(digitsOf(scrubText(atCap))).toBe('');
    expect(scrubText(`${atCap}a`)).toBe('[omitted:too_long]');
  });

  it('refuses a short string that grows past the cap when normalised', () => {
    const expanding = String.fromCodePoint(0xfdfa).repeat(200);
    expect(expanding.normalize('NFKC').length).toBeGreaterThan(SCRUB_MAX_INPUT_LENGTH);
    expect(scrubText(expanding)).toBe('[omitted:too_long]');
  });

  it('writes output of exactly the output cap whole and truncates one character more', () => {
    const atCap = 'a'.repeat(SCRUB_MAX_OUTPUT_LENGTH);
    expect(scrubText(atCap)).toBe(atCap);
    expect(scrubText(`${atCap}a`)).toHaveLength(SCRUB_MAX_OUTPUT_LENGTH);
  });

  it('handles the empty string and text in other scripts', () => {
    expect(scrubText('')).toBe('');
    const hindi = 'नेट मीटर लग गया, DISCOM वाले कल आएंगे';
    expect(scrubText(hindi)).toBe(hindi);
  });

  it('needs a character on both sides of the @ to call it an address', () => {
    expect(scrubText('@handle and a@ and @')).toBe('@handle and a@ and @');
    expect(scrubText('a@b')).toBe('[email]');
  });

  it('protects only real calendar dates', () => {
    expect(scrubText('2026-11-12')).toBe('2026-11-12');
    expect(scrubText('2026-13-12')).toBe('[number]');
    expect(scrubText('9876-54-32')).toBe('[number]');
  });
});

describe('limits: the logger', () => {
  it('accepts an event of 128 characters and refuses 129', () => {
    expect(write(undefined, undefined, 'e'.repeat(128)).event).toBe('e'.repeat(128));
    expect(write(undefined, undefined, 'e'.repeat(129)).event).toBe('log.invalid_event');
  });

  it('accepts a key of 64 characters and drops one of 65', () => {
    const fields: LogFields = { ['k'.repeat(64)]: 1, ['k'.repeat(65)]: 2 };
    const line = write({ fields });
    expect(line.fields).toEqual({ ['k'.repeat(64)]: 1 });
    expect(line.problems).toEqual({ dropped_fields: 1 });
  });

  it('writes exactly the field limit without a problem and counts the next one', () => {
    const many = (count: number): LogFields =>
      Object.fromEntries(Array.from({ length: count }, (_, index) => [`f_${String(index)}`, 1]));
    const atLimit = write({ fields: many(LOG_MAX_FIELDS) });
    expect(Object.keys(atLimit.fields ?? {})).toHaveLength(LOG_MAX_FIELDS);
    expect(atLimit.problems).toBeUndefined();
    expect(write({ fields: many(LOG_MAX_FIELDS + 1) }).problems).toEqual({ dropped_fields: 1 });
  });

  it('writes no fields key for an empty object or no data', () => {
    expect(Object.hasOwn(write({ fields: {} }), 'fields')).toBe(false);
    expect(Object.hasOwn(write({}), 'fields')).toBe(false);
    expect(Object.hasOwn(write(), 'error')).toBe(false);
  });

  it('accepts a system process name of 64 characters and marks one of 65', () => {
    const named = (length: number): Context =>
      contextFor(TENANT_A, 'req-1', { kind: 'system', process: 'p'.repeat(length) });
    expect(write(undefined, named(64)).actor['process']).toBe('p'.repeat(64));
    expect(write(undefined, named(65)).actor['process']).toBe('[invalid]');
  });

  it('keeps numbers as numbers: zero, negatives, decimals and the largest safe integer', () => {
    const fields: LogFields = {
      a_value: 0,
      b_value: -1,
      c_value: 0.5,
      d_value: Number.MAX_SAFE_INTEGER,
    };
    expect(write({ fields }).fields).toEqual(fields);
  });
});

describe('limits: summariseError', () => {
  it('keeps a numeric code of 7 digits and drops one of 8', () => {
    expect(summariseError({ code: 9_999_999 }).code).toBe(9_999_999);
    expect(summariseError({ code: 10_000_000 }).code).toBeUndefined();
    expect(summariseError({ code: -9_999_999 }).code).toBe(-9_999_999);
    expect(summariseError({ code: 1.5 }).code).toBeUndefined();
  });

  it('keeps a text code of 64 characters and drops one of 65', () => {
    expect(summariseError({ code: 'c'.repeat(64) }).code).toBe('c'.repeat(64));
    expect(summariseError({ code: 'c'.repeat(65) }).code).toBeUndefined();
    expect(summariseError({ code: '' }).code).toBeUndefined();
  });

  it('summarises exactly 3 causes below the error', () => {
    const chain = { cause: { cause: { cause: { cause: { cause: 'deepest' } } } } };
    const depth = (summary: ReturnType<typeof summariseError>): number =>
      summary.cause === undefined ? 0 : 1 + depth(summary.cause);
    expect(depth(summariseError(chain))).toBe(3);
  });

  it('caps a field path at 64 characters', () => {
    const error = coreError('VALIDATION_FAILED', {
      fields: [{ path: 'p'.repeat(200), code: 'required' }],
    });
    expect(summariseError(error).fields?.[0]?.path).toHaveLength(64);
  });

  it('ignores a stack that is not text or is too long to scan', () => {
    expect(summariseError({ stack: 42 }).frames).toBeUndefined();
    const long = `Error\n${'    at step (/srv/a.js:1:1)\n'.repeat(1_000)}`;
    expect(summariseError({ stack: long }).frames).toBeUndefined();
  });
});

describe('tenant attribution', () => {
  it('gives each line the tenant of its own context when calls interleave on one logger', () => {
    const lines: string[] = [];
    const logger = createLogger({ sink: (line) => lines.push(line), classification: lookup });
    const a = contextFor(TENANT_A, 'req-a');
    const b = contextFor(TENANT_B, 'req-b');
    for (let index = 0; index < 20; index += 1) {
      logger.info(index % 2 === 0 ? a : b, 'work.done');
    }
    lines.forEach((text, index) => {
      const line = JSON.parse(text) as Parsed;
      expect(line.tenant_id).toBe(index % 2 === 0 ? TENANT_A : TENANT_B);
      expect(line.correlation_id).toBe(index % 2 === 0 ? 'req-a' : 'req-b');
    });
  });

  it('asks the lookup with the context of the call, so tenant custom fields resolve per tenant', () => {
    const asked: (string | undefined)[] = [];
    const recording: ClassificationLookup = {
      classify: (context) => {
        asked.push(context.tenantId);
        return context.tenantId === TENANT_A ? 'public' : 'personal';
      },
    };
    const lines: string[] = [];
    const logger = createLogger({ sink: (line) => lines.push(line), classification: recording });
    const fields: LogFields = { a_value: classified({ entity: 'custom', field: 'f1' }, 'visible') };
    logger.info(contextFor(TENANT_A), 'job.updated', { fields });
    logger.info(contextFor(TENANT_B), 'job.updated', { fields });
    expect(asked).toEqual([TENANT_A, TENANT_B]);
    expect((JSON.parse(lines[0] ?? '') as Parsed).fields).toEqual({ a_value: 'visible' });
    expect((JSON.parse(lines[1] ?? '') as Parsed).fields).toEqual({ a_value: '[personal]' });
  });
});

describe('generated inputs', () => {
  const separator = fc.constantFrom('', ' ', '-', '.', ' - ', ') ', '/');
  /** A 10-digit number starting 6 to 9, split at a random place by a random separator. */
  const phone = fc
    .tuple(
      fc.integer({ min: 6, max: 9 }),
      fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 9, maxLength: 9 }),
      fc.integer({ min: 1, max: 9 }),
      separator,
      fc.constantFrom('', '+91 ', '+91-', '0'),
    )
    .map(([first, rest, cut, glue, prefix]) => {
      const digits = `${String(first)}${rest.join('')}`;
      return { digits, written: `${prefix}${digits.slice(0, cut)}${glue}${digits.slice(cut)}` };
    });
  /** Surrounding text without digits, so any digit run in the output came from the phone. */
  const prose = fc
    .string({ maxLength: 40 })
    .map((text) => text.replace(/\p{Nd}/gu, 'x').replace(/@/g, ' '));

  it('never leaves the digits of a phone number in scrubbed text', () => {
    fc.assert(
      fc.property(phone, prose, prose, ({ digits, written }, before, after) => {
        const output = scrubText(`${before} ${written} ${after}`);
        expect(digitsOf(output)).not.toContain(digits);
      }),
      { numRuns: 500 },
    );
  });

  it('never leaves an email address in scrubbed text', () => {
    const word = fc.stringMatching(/^[a-z]{3,10}$/);
    fc.assert(
      fc.property(word, word, prose, prose, (local, domain, before, after) => {
        const address = `${local}.q@${domain}.test`;
        expect(scrubText(`${before} ${address} ${after}`)).not.toContain(`${local}.q@`);
      }),
      { numRuns: 300 },
    );
  });

  it('is stable: scrubbing scrubbed text changes nothing more', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (text) => {
        const once = scrubText(text);
        expect(scrubText(once)).toBe(once);
      }),
      { numRuns: 500 },
    );
  });

  it('writes one parseable line inside the byte budget for any fields and error, and never throws', () => {
    const lines: string[] = [];
    const logger = createLogger({
      sink: (line) => lines.push(line),
      classification: lookup,
      minLevel: 'debug',
    });
    const encoder = new TextEncoder();
    const anyContext = fc.constantFrom(contextFor(TENANT_A), contextFor(TENANT_B, 'req-b'));
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ maxLength: 70 }), fc.anything(), { maxKeys: 80 }),
        fc.anything(),
        fc.string({ maxLength: 140 }),
        anyContext,
        (fields, error, event, ctx) => {
          lines.length = 0;
          logger.error(ctx, event, { fields: fields as LogFields, error });
          expect(lines).toHaveLength(1);
          const text = lines[0] ?? '';
          expect(text).not.toMatch(/[\n\r]/);
          expect(encoder.encode(text).length).toBeLessThanOrEqual(LOG_MAX_LINE_BYTES);
          const line = JSON.parse(text) as Parsed;
          expect(line.tenant_id).toBe(ctx.tenantId);
          expect(line.correlation_id).toBe(ctx.correlationId);
        },
      ),
      { numRuns: 500 },
    );
  });
});
