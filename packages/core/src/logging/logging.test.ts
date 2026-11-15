import { describe, expect, it } from 'vitest';
import type { Clock } from '../clock.ts';
import {
  createContext,
  deriveContext,
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
import { moduleId } from '../module-id.ts';
import type { Classification, ClassificationLookup } from '../ports/classification.ts';
import { Secret } from '../ports/secret.ts';
import { summariseError, type ErrorSummary } from './error-summary.ts';
import {
  LOG_MAX_FIELDS,
  LOG_MAX_LINE_BYTES,
  classified,
  createLogger,
  type LogData,
  type LogFields,
  type LoggerOptions,
} from './logger.ts';
import { SCRUB_MAX_INPUT_LENGTH, SCRUB_MAX_OUTPUT_LENGTH, scrubText } from './scrub.ts';

// Threat model: docs/security/threat-models/K0-T04-logging.md. Test ids T1 to T18 refer to it.

const clock: Clock = { nowMillis: () => 0, monotonicMillis: () => 0 };
const TENANT = parseTenantId('0190f3e2-7a1b-7c3d-8e4f-0000000000a1') as TenantId;
const OTHER_TENANT = parseTenantId('0190f3e2-7a1b-7c3d-8e4f-0000000000a2') as TenantId;
const USER = parseId('0190f3e2-7a1b-7c3d-8e4f-0000000000b1') as Id;
const SESSION = parseId('0190f3e2-7a1b-7c3d-8e4f-0000000000c1') as Id;
const JOB = parseId('0190f3e2-7a1b-7c3d-8e4f-0000000000d1') as Id;
const correlationId = parseCorrelationId('req-1') as CorrelationId;
const AI_CLIENT = parseAiClientId('https://client.test/app') as AiClientId;

const fromCodes = (...codes: number[]): string => String.fromCodePoint(...codes);
const BACKSLASH = fromCodes(92);
const ZERO_WIDTH_SPACE = fromCodes(0x200b);
const NO_BREAK_SPACE = fromCodes(0xa0);
const MIDDLE_DOT = fromCodes(0xb7);
const FULL_WIDTH_AT = fromCodes(0xff20);
const LINE_SEPARATOR = fromCodes(0x2028);
const RIGHT_TO_LEFT_OVERRIDE = fromCodes(0x202e);
const ESCAPE = fromCodes(27);
const C1_CONTROL = fromCodes(0x9b);
const DEVANAGARI_ZERO = 0x966;
const FULL_WIDTH_ZERO = 0xff10;
const inScript = (digits: string, zero: number): string =>
  Array.from(digits, (digit) => fromCodes(zero + Number(digit))).join('');

const PHONE = '9876543210';
const PHONE_SEEDS = [
  PHONE,
  '+91 98765 43210',
  '+91-98765-43210',
  '(+91) 98765.43210',
  '098765 43210',
  '98765 - 43210',
  inScript(PHONE, DEVANAGARI_ZERO),
  inScript(PHONE, FULL_WIDTH_ZERO),
  `98765${ZERO_WIDTH_SPACE}43210`,
  `98765${NO_BREAK_SPACE}43210`,
  '98765_43210',
  '98765,43210',
  '98765+43210',
  `98765${MIDDLE_DOT}43210`,
];
/** The same number in digits that are not decimal digits until normalised. */
const CIRCLED_PHONE = fromCodes(
  0x2468,
  0x2467,
  0x2466,
  0x2465,
  0x2464,
  0x2463,
  0x2462,
  0x2461,
  0x2460,
  0x24ea,
);
const SUPERSCRIPT_PHONE = fromCodes(
  0x2079,
  0x2078,
  0x2077,
  0x2076,
  0x2075,
  0x2074,
  0xb3,
  0xb2,
  0xb9,
  0x2070,
);
const EMAIL_SEEDS = [
  'seed.person+tag@example.co.in',
  'SEED@EXAMPLE.COM',
  'seed%40example.com',
  'rahul.s@okaxis',
  `alice${FULL_WIDTH_AT}example.com`,
  '"john.doe"@example.com',
  "o'brien@example.com",
  'seed_person@example.com',
];
const ID_SEEDS = ['2345 6789 0123', '4111-1111-1111-1111', 'ABCPE1234F', '27ABCPE1234F1Z5'];
const SEEDS = [...PHONE_SEEDS, ...EMAIL_SEEDS, ...ID_SEEDS];

/** The digits of a text as ASCII, whatever script they were written in. */
function asciiDigits(text: string): string {
  return [...text.matchAll(/\p{Nd}/gu)]
    .map(([digit]) => {
      const code = digit.codePointAt(0) ?? 0;
      if (code >= FULL_WIDTH_ZERO) return String(code - FULL_WIDTH_ZERO);
      return code >= DEVANAGARI_ZERO ? String(code - DEVANAGARI_ZERO) : digit;
    })
    .join('');
}

/** The seed is gone: not as written, not as its digits, and not as any of its words. */
function expectNoLeak(output: string, seed: string): void {
  expect(output).not.toContain(seed);
  const digits = asciiDigits(seed);
  if (digits.length >= 8) expect(asciiDigits(output)).not.toContain(digits);
  for (const word of seed.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
    expect(output.toLowerCase()).not.toContain(word);
  }
}

const CLASSES: Readonly<Record<string, Classification>> = {
  'job.status': 'public',
  'job.note': 'internal',
  'client.contact': 'personal',
  'client.health': 'sensitive_personal',
  'gateway.key': 'secret',
};
const lookup: ClassificationLookup = {
  classify: (_context, field) => CLASSES[`${field.entity}.${field.field}`] ?? 'secret',
};

function context(actor: Actor = { kind: 'user', userId: USER }, tenantId?: TenantId): Context {
  return createContext({
    actor,
    correlationId,
    clock,
    ...(tenantId === undefined ? {} : { tenantId }),
  });
}
const tenantContext = (actor?: Actor): Context => context(actor, TENANT);

interface ParsedLine {
  readonly ts: string | null;
  readonly level: string;
  readonly event: string;
  readonly module?: string;
  readonly correlation_id: string;
  readonly tenant_id: string | null;
  readonly actor: Readonly<Record<string, unknown>>;
  readonly initiated_by?: Readonly<Record<string, unknown>>;
  readonly causation_id?: string;
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly error?: ErrorSummary;
  readonly problems?: Readonly<Record<string, unknown>>;
  readonly redaction_failed?: boolean;
}

interface Capture {
  readonly lines: string[];
  readonly logger: ReturnType<typeof createLogger>;
}

function capture(options: Partial<LoggerOptions> = {}): Capture {
  const lines: string[] = [];
  const logger = createLogger({
    sink: (line) => lines.push(line),
    classification: lookup,
    minLevel: 'debug',
    ...options,
  });
  return { lines, logger };
}

/** Writes one info line and returns it as text and as parsed JSON. */
function write(
  data?: LogData,
  ctx: Context = tenantContext(),
  event = 'job.updated',
): { text: string; line: ParsedLine } {
  const { lines, logger } = capture();
  logger.info(ctx, event, data);
  expect(lines).toHaveLength(1);
  const text = lines[0] ?? '';
  return { text, line: JSON.parse(text) as ParsedLine };
}

class DatabaseError extends Error {
  readonly code = '23505';
  readonly detail: string;
  constructor(message: string, detail: string) {
    super(message);
    this.name = 'DatabaseError';
    this.detail = detail;
  }
}

describe('scrubText', () => {
  it.each(SEEDS)('masks the seed %s inside a sentence (T3, T4)', (seed) => {
    expectNoLeak(scrubText(`reach them on ${seed} today`), seed);
  });

  it.each(PHONE_SEEDS)('writes [number] for the phone form %s (T4)', (seed) => {
    expect(scrubText(`ph ${seed}`)).toContain('[number]');
  });

  it.each(EMAIL_SEEDS)('writes [email] for %s', (seed) => {
    expect(scrubText(seed)).toBe('[email]');
  });

  it('writes [id] for the tax id shape, also in lower case and inside a longer token', () => {
    expect(scrubText('ABCPE1234F')).toBe('[id]');
    expect(scrubText('abcpe1234f')).toBe('[id]');
    expect(scrubText('27ABCPE1234F1Z5')).toBe('27[id]1Z5');
  });

  it('keeps record ids, ISO dates and short numbers (T5)', () => {
    const text = `id=${JOB} ph=${PHONE} on 2026-11-12T10:30:00.000Z or 2026-11-12, count 1234567`;
    expect(scrubText(text)).toBe(
      `id=${JOB} ph=[number] on 2026-11-12T10:30:00.000Z or 2026-11-12, count 1234567`,
    );
  });

  it('does not protect an id or a date that is glued to more digits', () => {
    expectNoLeak(scrubText(`${PHONE}${JOB}`), PHONE);
    expectNoLeak(scrubText(`2026-11-12-${PHONE}`), PHONE);
    expect(scrubText('98-2026-11-12-55')).toBe('[number]');
  });

  it('masks a date of birth written with slashes', () => {
    expect(scrubText('born 04/11/1990')).toBe('born [number]');
  });

  it('removes the query string and fragment of a URL but keeps host and path (T10)', () => {
    expect(scrubText(`see https://x.test/cb/${JOB}?code=abc&state=1#t=1 now`)).toBe(
      `see https://x.test/cb/${JOB}[query] now`,
    );
    expect(scrubText('https://x.test/reset#access=abc')).toBe('https://x.test/reset[query]');
  });

  it('masks bearer and JWT-shaped tokens (T10)', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
    expect(scrubText(`Authorization: Bearer ${jwt}`)).toBe('Authorization: [secret]');
    expect(scrubText(`token was ${jwt}.`)).toBe('token was [secret].');
    expect(scrubText('bearer abc.def-123')).toBe('[secret]');
  });

  it('masks credentials in the user part of a URL', () => {
    expect(scrubText('postgres://app:hunter2@db.internal/main')).toBe(
      'postgres://[credentials]@db.internal/main',
    );
    expect(scrubText('postgres://admin:pa!ss#word@db/main')).not.toContain('pa!ss');
  });

  it('masks the value after the name of a secret', () => {
    expect(scrubText('Authorization: Basic dXNlcjpwYXNzd29yZA==')).toBe('Authorization: [secret]');
    expect(scrubText('api_key=sk_live_abc&page=2')).toBe('api_key=[secret]&page=2');
    expect(scrubText('x-api-key: 5f2b77')).toBe('x-api-key: [secret]');
    expect(scrubText('example.test/reset?token=abc123')).toBe('example.test/reset?token=[secret]');
    expect(scrubText('{"password":"hunter2","page":2}')).not.toContain('hunter2');
    expect(scrubText('Bearer:abc.def')).toBe('[secret]');
  });

  it('sees through compatibility characters (review L1)', () => {
    expect(scrubText(`ph ${CIRCLED_PHONE}`)).toBe('ph [number]');
    expect(scrubText(`ph ${SUPERSCRIPT_PHONE}`)).toBe('ph [number]');
    expect(scrubText(`alice${FULL_WIDTH_AT}example.com`)).toBe('[email]');
  });

  it('masks the whole of an address with a quoted or unusual local part', () => {
    expect(scrubText('"john.doe"@example.com')).toBe('[email]');
    expect(scrubText("o'brien@example.com")).toBe('[email]');
    expect(scrubText('seed_person@example.com')).toBe('[email]');
  });

  it('keeps a scoped package path readable', () => {
    const path = '/srv/app/node_modules/@gx/core/dist/index.js';
    expect(scrubText(path)).toBe(path);
  });

  it('leaves ordinary text alone', () => {
    const text = 'Stage moved from survey to install; 3 of 12 lines received at 10:30';
    expect(scrubText(text)).toBe(text);
  });

  it('replaces a string over the input cap and truncates long output (T15)', () => {
    expect(scrubText('a'.repeat(SCRUB_MAX_INPUT_LENGTH + 1))).toBe('[omitted:too_long]');
    expect(scrubText('a'.repeat(1_000_000))).toBe('[omitted:too_long]');
    const truncated = scrubText('word '.repeat(400));
    expect(truncated).toHaveLength(SCRUB_MAX_OUTPUT_LENGTH);
    expect(truncated.endsWith('...[truncated]')).toBe(true);
  });

  it('does not reveal part of a match when it truncates', () => {
    const text = `${'x'.repeat(SCRUB_MAX_OUTPUT_LENGTH - 5)}${PHONE} ${'y'.repeat(200)}`;
    expectNoLeak(scrubText(text), PHONE);
    expect(asciiDigits(scrubText(text))).toBe('');
  });

  it.each([
    ['digits and spaces', '1 '.repeat(SCRUB_MAX_INPUT_LENGTH / 2)],
    ['address characters', 'a@'.repeat(SCRUB_MAX_INPUT_LENGTH / 2)],
    ['URL starts', '://'.repeat(Math.floor(SCRUB_MAX_INPUT_LENGTH / 3))],
    ['token starts', 'eyJ'.repeat(Math.floor(SCRUB_MAX_INPUT_LENGTH / 3))],
    ['tax id starts', 'ABCPE1234'.repeat(Math.floor(SCRUB_MAX_INPUT_LENGTH / 9))],
    ['open brackets', '('.repeat(SCRUB_MAX_INPUT_LENGTH)],
  ])('scans adversarial %s inside the time budget (T15)', (_name, text) => {
    const budgetMillis = 100;
    const started = performance.now();
    scrubText(text);
    expect(performance.now() - started).toBeLessThan(budgetMillis);
  });
});

describe('summariseError', () => {
  it('summarises a catalogue error with a scrubbed detail and its field problems', () => {
    const error = coreError('VALIDATION_FAILED', {
      detail: `row for ${PHONE} was refused`,
      fields: [{ path: 'contacts.0.seed@example.com', code: 'required' }],
      retryAfterSeconds: 30,
    });
    expect(summariseError(error)).toEqual({
      type: 'AppError',
      code: 'VALIDATION_FAILED',
      status: 400,
      retryable: false,
      detail: 'row for [number] was refused',
      fields: [{ path: '[email]', code: 'required' }],
      retry_after_seconds: 30,
    });
  });

  it('caps field problems at 20 and marks a code that is not a short code', () => {
    const fields = Array.from({ length: 25 }, (_, index) => ({
      path: `lines.${String(index)}`,
      code: index === 0 ? `bad code ${PHONE}` : 'required',
    }));
    const summary = summariseError(coreError('VALIDATION_FAILED', { fields }));
    expect(summary.fields).toHaveLength(20);
    expect(summary.fields?.[0]).toEqual({ path: 'lines.0', code: '[invalid]' });
  });

  it('never reads the message or detail of a database error, thrown or as a cause (T6)', () => {
    const database = new DatabaseError(
      `duplicate key value ${PHONE}`,
      'Key (email)=(seed@example.com) already exists.',
    );
    const thrown = summariseError(database);
    expect(thrown.type).toBe('DatabaseError');
    expect(thrown.code).toBe('23505');
    expect(thrown.detail).toBeUndefined();
    expect(thrown.frames?.length).toBeGreaterThan(0);

    const wrapped = summariseError(coreError('INTERNAL', { cause: database }));
    expect(wrapped.cause?.type).toBe('DatabaseError');
    expect(wrapped.cause?.code).toBe('23505');
    for (const text of [JSON.stringify(thrown), JSON.stringify(wrapped)]) {
      expectNoLeak(text, PHONE);
      expectNoLeak(text, 'seed@example.com');
      expect(text).not.toContain('duplicate');
    }
  });

  it('treats an object that only looks like a catalogue error as foreign (T6)', () => {
    const lookalike = { code: 'CONFLICT', status: 409, detail: `phone ${PHONE}`, fields: [] };
    expect(summariseError(lookalike)).toEqual({ type: 'Object', code: 'CONFLICT' });
    const taxIdCode = {
      code: 'ABCPD1234F',
      status: 400,
      retryable: false,
      fields: [],
      message: 'm',
      retryAfterSeconds: Number(PHONE),
    };
    expect(summariseError(taxIdCode)).toEqual({ type: 'Object' });
    const longDelay = { ...taxIdCode, code: 'RATE_LIMITED' };
    expect(summariseError(longDelay).retry_after_seconds).toBeUndefined();
    const noMessage = { ...lookalike, retryable: false };
    expect(summariseError(noMessage)).toEqual({ type: 'Object', code: 'CONFLICT' });
    const notRetryable = { ...lookalike, message: 'text' };
    expect(summariseError(notRetryable)).toEqual({ type: 'Object', code: 'CONFLICT' });
    const complete = { ...lookalike, message: 'text', retryable: false };
    expect(summariseError(complete).type).toBe('AppError');
  });

  it('keeps only real stack frames, scrubbed, at most 10', () => {
    const error = new Error('first line');
    error.stack = [
      `Error: first line with ${PHONE}`,
      '    at home with seed@example.com',
      '    at Ravi Kumar, 12 MG Road Bengaluru:56:1',
      '    at async Promise.all (index 0)',
      `    at lookup (/srv/app/${PHONE}/file.js:10:5)`,
      ...Array.from({ length: 15 }, (_, index) => `    at step${String(index)} (/srv/a.js:1:1)`),
    ].join('\n');
    const frames = summariseError(error).frames ?? [];
    expect(frames).toHaveLength(10);
    expect(frames[0]).toBe('at lookup (/srv/app/[number]/file.js:10:5)');
    expect(frames.join(' ')).not.toContain('Ravi');
    expectNoLeak(frames.join('\n'), 'seed@example.com');
  });

  it('takes frames only from the first foreign error in a chain', () => {
    const inner = new Error('inner');
    const outer = new Error('outer', { cause: inner });
    const summary = summariseError(outer);
    expect(summary.frames?.length).toBeGreaterThan(0);
    expect(summary.cause).toEqual({ type: 'Error' });
  });

  it('stops a circular cause chain at depth 3 (T7)', () => {
    const circular: { cause?: unknown } = {};
    circular.cause = circular;
    expect(summariseError(circular)).toEqual({
      type: 'Object',
      cause: { type: 'Object', cause: { type: 'Object', cause: { type: 'Object' } } },
    });
  });

  it('survives hostile error shapes (T7)', () => {
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    expect(summariseError(revocable.proxy)).toEqual({ type: 'Unknown' });

    const throwing = Object.defineProperty({}, 'constructor', {
      get: (): never => {
        throw new Error('trap');
      },
    });
    expect(summariseError(throwing)).toEqual({ type: 'Unknown' });

    class C9876543210 extends Error {}
    expect(summariseError(new C9876543210('x')).type).toBe('Unknown');

    const oddName = (): void => undefined;
    Object.defineProperty(oddName, 'name', { value: 'x\ny' });
    expect(summariseError({ constructor: oddName })).toEqual({ type: 'Unknown' });
  });

  it('drops a code that could be personal data and keeps a short numeric one (T7)', () => {
    expect(summariseError({ code: PHONE })).toEqual({ type: 'Object' });
    expect(summariseError({ code: Number(PHONE) })).toEqual({ type: 'Object' });
    expect(summariseError({ code: 'seed@example.com' })).toEqual({ type: 'Object' });
    expect(summariseError({ code: 404 })).toEqual({ type: 'Object', code: 404 });
    expect(summariseError({ code: 'ECONNRESET' })).toEqual({ type: 'Object', code: 'ECONNRESET' });
  });

  it('names the type of a thrown primitive and never its value', () => {
    expect(summariseError(`boom ${PHONE}`)).toEqual({ type: 'string' });
    expect(summariseError(null)).toEqual({ type: 'null' });
    expect(summariseError(undefined)).toEqual({ type: 'undefined' });
    expect(summariseError(42)).toEqual({ type: 'number' });
  });
});

describe('createLogger: the envelope', () => {
  it('writes one JSON line with time, level, event, correlation id, tenant and actor', () => {
    const { text, line } = write();
    expect(text).not.toContain('\n');
    expect(line).toEqual({
      ts: '1970-01-01T00:00:00.000Z',
      level: 'info',
      event: 'job.updated',
      correlation_id: 'req-1',
      tenant_id: TENANT,
      actor: { kind: 'user', user_id: USER },
    });
  });

  it('carries tenant, actor and correlation id on 50 of 50 lines (F-02-AC1, T17)', () => {
    const actors: Actor[] = [
      { kind: 'user', userId: USER },
      {
        kind: 'user',
        userId: USER,
        via: { kind: 'ai_client', clientId: AI_CLIENT, scopes: ['read'] },
      },
      { kind: 'service_account', serviceAccountId: USER },
      { kind: 'operator', operatorId: USER, supportSessionId: SESSION },
      { kind: 'system', process: 'outbox.dispatcher' },
      { kind: 'anonymous' },
    ];
    const { lines, logger } = capture();
    const levels = ['debug', 'info', 'warn', 'error'] as const;
    for (let index = 0; index < 50; index += 1) {
      const actor = actors[index % actors.length] as Actor;
      const withTenant = index % 2 === 0;
      logger[levels[index % levels.length] ?? 'info'](
        withTenant ? tenantContext(actor) : context(actor),
        'work.done',
      );
    }
    expect(lines).toHaveLength(50);
    lines.forEach((text, index) => {
      const line = JSON.parse(text) as ParsedLine;
      expect(line.correlation_id).toBe('req-1');
      expect(Object.hasOwn(line, 'tenant_id')).toBe(true);
      expect(line.tenant_id).toBe(index % 2 === 0 ? TENANT : null);
      expect(line.actor['kind']).toBe(actors[index % actors.length]?.kind);
      expect(line.problems).toBeUndefined();
    });
  });

  it('projects each actor kind to its kind and ids', () => {
    const via = { kind: 'ai_client', clientId: AI_CLIENT, scopes: ['read', 'write'] } as const;
    expect(write(undefined, tenantContext({ kind: 'user', userId: USER, via })).line.actor).toEqual(
      { kind: 'user', user_id: USER, via: { client_id: AI_CLIENT, scopes: ['read', 'write'] } },
    );
    expect(
      write(
        undefined,
        tenantContext({ kind: 'operator', operatorId: USER, supportSessionId: SESSION }),
      ).line.actor,
    ).toEqual({ kind: 'operator', operator_id: USER, support_session_id: SESSION });
    expect(
      write(undefined, tenantContext({ kind: 'system', process: 'outbox.dispatcher' })).line.actor,
    ).toEqual({ kind: 'system', process: 'outbox.dispatcher' });
    expect(write(undefined, context({ kind: 'anonymous' })).line.actor).toEqual({
      kind: 'anonymous',
    });
  });

  it('keeps the initiating actor and the cause on a derived context', () => {
    const derived = deriveContext(tenantContext(), {
      causationId: JOB,
      actor: { kind: 'system', process: 'scheduler' },
    });
    const { line } = write(undefined, derived);
    expect(line.actor).toEqual({ kind: 'system', process: 'scheduler' });
    expect(line.initiated_by).toEqual({ kind: 'user', user_id: USER });
    expect(line.causation_id).toBe(JOB);
  });

  it('names the module when one is given', () => {
    const { lines, logger } = capture({ module: moduleId('k1-tenancy') });
    logger.info(tenantContext(), 'tenant.created');
    expect((JSON.parse(lines[0] ?? '') as ParsedLine).module).toBe('k1-tenancy');
  });

  it('cannot be overwritten by fields (T11)', () => {
    const fields: LogFields = { tenant_id: OTHER_TENANT, correlation_id: 'forged', level: 'error' };
    const { line } = write({ fields });
    expect(line.tenant_id).toBe(TENANT);
    expect(line.correlation_id).toBe('req-1');
    expect(line.level).toBe('info');
    expect(line.fields).toEqual({
      tenant_id: OTHER_TENANT,
      correlation_id: 'forged',
      level: 'error',
    });
  });

  it('re-checks a hand-built context and writes [invalid] for what fails (T12)', () => {
    const handBuilt = {
      correlationId: 'seed@example.com',
      tenantId: PHONE,
      actor: { kind: 'user', userId: USER, contact: 'leak@example.com' },
      clock,
    } as unknown as Context;
    const { text, line } = write(undefined, handBuilt);
    expect(line.correlation_id).toBe('[invalid]');
    expect(line.tenant_id).toBe('[invalid]');
    expect(line.actor).toEqual({ kind: 'user', user_id: USER });
    expect(line.problems).toEqual({ invalid_context: 2 });
    expectNoLeak(text, PHONE);
    expectNoLeak(text, 'seed@example.com');
    expectNoLeak(text, 'leak@example.com');
  });

  it('does not write a correlation id that looks like a phone number or an id (review M3)', () => {
    const withId = (id: string): Context =>
      ({ ...tenantContext(), correlationId: parseCorrelationId(id) }) as Context;
    for (const id of [PHONE, 'ABCPD1234F', '98765-43210', 'call-9876543210']) {
      const { text, line } = write(undefined, withId(id));
      expect(line.correlation_id).toBe('[invalid]');
      expect(line.problems).toEqual({ invalid_context: 1 });
      expect(text).not.toContain(id);
    }
    for (const id of ['req-1', USER, 'job:2026-11-12.retry_3']) {
      expect(write(undefined, withId(id)).line.correlation_id).toBe(id);
    }
  });

  it('marks an unknown actor kind and a system process that is not an identifier', () => {
    const unknownKind = { ...tenantContext(), actor: { kind: 'robot' } } as unknown as Context;
    expect(write(undefined, unknownKind).line.actor).toEqual({ kind: '[invalid]' });
    const process = `sync for ${PHONE}`;
    const { text, line } = write(undefined, tenantContext({ kind: 'system', process }));
    expect(line.actor).toEqual({ kind: 'system', process: '[invalid]' });
    expectNoLeak(text, PHONE);
  });

  it('drops the query string of an AI client id that is a URL (T10)', () => {
    const clientId = parseAiClientId('https://client.test/app?token=abc123#frag');
    const via = { kind: 'ai_client', clientId, scopes: ['read', 'admin'] };
    const actor = { kind: 'user', userId: USER, via } as unknown as Actor;
    const { text, line } = write(undefined, tenantContext(actor));
    expect(line.actor['via']).toEqual({
      client_id: 'https://client.test/app[query]',
      scopes: ['read'],
    });
    expect(text).not.toContain('abc123');

    const bare = { kind: 'ai_client', clientId: parseAiClientId('app-7?token=abc123'), scopes: [] };
    const bareActor = { kind: 'user', userId: USER, via: bare } as unknown as Actor;
    const second = write(undefined, tenantContext(bareActor));
    expect(second.line.actor['via']).toEqual({ client_id: 'app-7[query]', scopes: [] });
    expect(second.text).not.toContain('abc123');
  });

  it.each(['user.login 9876543210', 'login.a9876543210', 'Login', 'a.'.repeat(64) + 'b', ''])(
    'replaces the event name %j with a marker (T14)',
    (event) => {
      const { text, line } = write(undefined, tenantContext(), event);
      expect(line.event).toBe('log.invalid_event');
      expect(line.problems).toEqual({ invalid_event: true });
      expectNoLeak(text, PHONE);
    },
  );
});

describe('createLogger: fields', () => {
  it('masks classified values by class and writes public and internal ones (T1)', () => {
    const fields: LogFields = {
      a_value: classified({ entity: 'client', field: 'contact' }, PHONE),
      b_value: classified({ entity: 'client', field: 'health' }, 'diabetic'),
      c_value: classified({ entity: 'gateway', field: 'key' }, 'sk_live_abc'),
      d_value: classified({ entity: 'job', field: 'status' }, 'installed'),
      e_value: classified({ entity: 'job', field: 'note' }, 7),
    };
    const { text, line } = write({ fields });
    expect(line.fields).toEqual({
      a_value: '[personal]',
      b_value: '[sensitive_personal]',
      c_value: '[secret]',
      d_value: 'installed',
      e_value: 7,
    });
    expectNoLeak(text, PHONE);
    expect(text).not.toContain('diabetic');
    expect(text).not.toContain('sk_live_abc');
    expect(line.problems).toBeUndefined();
  });

  it('treats an unknown field, a throwing lookup and a malformed answer as secret (T2)', () => {
    const failing: ClassificationLookup = {
      classify: (_context, field) => {
        if (field.entity === 'throws') throw new Error('cache cold');
        if (field.entity === 'malformed') return 'PUBLIC' as Classification;
        return lookup.classify(_context, field);
      },
    };
    const { lines, logger } = capture({ classification: failing });
    const fields: LogFields = {
      a_value: classified({ entity: 'nobody', field: 'knows' }, 'one'),
      b_value: classified({ entity: 'throws', field: 'x' }, 'two'),
      c_value: classified({ entity: 'malformed', field: 'x' }, 'three'),
    };
    logger.info(tenantContext(), 'job.updated', { fields });
    const line = JSON.parse(lines[0] ?? '') as ParsedLine;
    expect(line.fields).toEqual({ a_value: '[secret]', b_value: '[secret]', c_value: '[secret]' });
    expect(line.problems).toEqual({ classification_errors: 2 });
  });

  it('scrubs a classified value that is public or internal', () => {
    const fields: LogFields = {
      a_value: classified({ entity: 'job', field: 'note' }, `call ${PHONE}`),
    };
    expect(write({ fields }).line.fields).toEqual({ a_value: 'call [number]' });
  });

  const channels: readonly (readonly [
    string,
    (seed: string) => [LogData | undefined, Context?],
  ])[] = [
    ['an unclassified field value', (seed) => [{ fields: { note: `call ${seed} now` } }]],
    [
      'an internal classified value',
      (seed) => [{ fields: { note: classified({ entity: 'job', field: 'note' }, seed) } }],
    ],
    [
      'the detail of a catalogue error',
      (seed) => [{ error: coreError('INTERNAL', { detail: `failed for ${seed}` }) }],
    ],
    [
      'a field path of a catalogue error',
      (seed) => [
        { error: coreError('VALIDATION_FAILED', { fields: [{ path: seed, code: 'bad' }] }) },
      ],
    ],
    [
      'the message of a thrown error',
      (seed) => [{ error: new DatabaseError(`row ${seed} exists`, `Key (${seed})`) }],
    ],
    ['the code of a foreign error', (seed) => [{ error: { code: seed } }]],
    [
      'a system process name',
      (seed) => [undefined, tenantContext({ kind: 'system', process: seed })],
    ],
    [
      'an AI client id',
      (seed) => [
        undefined,
        tenantContext({
          kind: 'user',
          userId: USER,
          via: { kind: 'ai_client', clientId: seed as AiClientId, scopes: [] },
        }),
      ],
    ],
    ['the tenant id', (seed) => [undefined, { ...tenantContext(), tenantId: seed } as Context]],
    [
      'the causation id',
      (seed) => [undefined, { ...tenantContext(), causationId: seed } as Context],
    ],
  ];
  const cases = channels.flatMap(([name, build]) => SEEDS.map((seed) => [seed, name, build]));

  it.each(cases)('does not leak the seed %s through %s (F-02-AC3, T3)', (seed, _name, build) => {
    const [data, ctx] = (build as (seed: string) => [LogData | undefined, Context?])(
      seed as string,
    );
    expectNoLeak(write(data, ctx).text, seed as string);
  });

  it('masks a phone number, an email and an ID pattern in one line (F-02-AC3)', () => {
    const fields: LogFields = { note: `ph ${PHONE}, mail seed@example.com, tax id ABCPE1234F` };
    expect(write({ fields }).line.fields).toEqual({
      note: 'ph [number], mail [email], tax id [id]',
    });
  });

  it('writes scalars only: objects and arrays are named, never dumped (T8)', () => {
    const body = { customer: { contact: PHONE } };
    const fields = {
      a_value: body,
      b_value: [PHONE],
      c_value: new Map([['k', PHONE]]),
      d_value: new Date(0),
      e_value: Object(PHONE) as object,
      f_value: 10n,
      g_value: Symbol(PHONE),
      h_value: (): string => PHONE,
      i_value: undefined,
      j_value: Number.NaN,
      k_value: new Secret('sk_live_abc'),
      l_value: true,
      m_value: null,
      n_value: 12.5,
    } as unknown as LogFields;
    const { text, line } = write({ fields });
    expect(line.fields).toEqual({
      a_value: '[omitted:object]',
      b_value: '[omitted:array]',
      c_value: '[omitted:object]',
      d_value: '[omitted:object]',
      e_value: '[omitted:object]',
      f_value: '[omitted:bigint]',
      g_value: '[omitted:symbol]',
      h_value: '[omitted:function]',
      i_value: '[omitted:undefined]',
      j_value: '[omitted:number]',
      k_value: '[secret]',
      l_value: true,
      m_value: null,
      n_value: 12.5,
    });
    expectNoLeak(text, PHONE);
    expect(text).not.toContain('sk_live_abc');
  });

  it('does not accept a wrapper it did not make (requirement 12)', () => {
    const lookalike = { field: { entity: 'job', field: 'status' }, value: PHONE };
    const fields = { a_value: lookalike } as unknown as LogFields;
    expect(write({ fields }).line.fields).toEqual({ a_value: '[omitted:object]' });
  });

  it('prints a classified wrapper as [classified] outside the logger', () => {
    const wrapper = classified({ entity: 'client', field: 'contact' }, PHONE);
    expect(String(wrapper)).toBe('[classified]');
    expect(JSON.stringify({ wrapper })).toBe('{"wrapper":"[classified]"}');
    expect(Object.keys(wrapper)).toEqual([]);
  });

  it('masks by key name whatever the shape of the value (T9)', () => {
    const nationalIdKey = ['aad', 'haar'].join('');
    const fields: LogFields = {
      password: 'hunter2',
      refresh_token: 'x-opaque',
      otp: 123456,
      mobile: 9876543210,
      client_ip: '10.0.0.7',
      tokens: 512,
      pan: 'not-the-shape',
      [nationalIdKey]: 'not-the-shape',
      first_name: 'Rahul',
      private_key: 'pem-body',
      status: classified({ entity: 'job', field: 'status' }, 'ok'),
      session_note: classified({ entity: 'job', field: 'note' }, 'kept secret'),
    };
    expect(write({ fields }).line.fields).toEqual({
      password: '[secret]',
      refresh_token: '[secret]',
      otp: '[secret]',
      mobile: '[personal]',
      client_ip: '[personal]',
      tokens: '[secret]',
      pan: '[sensitive_personal]',
      [nationalIdKey]: '[sensitive_personal]',
      first_name: '[personal]',
      private_key: '[secret]',
      status: 'ok',
      session_note: '[secret]',
    });
  });

  it('masks a listed word that is joined to another without an underscore (review M2)', () => {
    const fields: LogFields = {
      newpassword: 'hunter2',
      accesstoken: 'abc',
      otpcode: 123456,
      mobileno: 9876543210,
      phonenumber: 9876543210,
      apikey: 'k',
      useremail: 'x',
    };
    expect(write({ fields }).line.fields).toEqual({
      newpassword: '[secret]',
      accesstoken: '[secret]',
      otpcode: '[secret]',
      mobileno: '[personal]',
      phonenumber: '[personal]',
      apikey: '[secret]',
      useremail: '[personal]',
    });
  });

  it('keeps booleans and keys that only contain a listed word (T9)', () => {
    const fields: LogFields = {
      phone_verified: true,
      email_missing: null,
      zip: '411001',
      ship_date: '2026-11-12',
      company: 'Acme',
      span_count: 3,
      spin: 'left',
      pipeline: 'ci',
      vipan: 'x',
      idempotency_key: 'abc',
    };
    expect(write({ fields }).line.fields).toEqual(fields);
  });

  it('documents the limit: a number under a key the list does not name is written (T9)', () => {
    const fields: LogFields = { contact: 9876543210 };
    expect(write({ fields }).line.fields).toEqual({ contact: 9876543210 });
  });

  it('drops keys that are not lower_snake_case or that carry data (T14)', () => {
    const fields = {
      ['__proto__']: 'x',
      a9876543210: 'x',
      phoneNumber: 'x',
      'has space': 'x',
      ok_key: 'kept',
    } as unknown as LogFields;
    const { text, line } = write({ fields });
    expect(line.fields).toEqual({ ok_key: 'kept' });
    expect(line.problems).toEqual({ dropped_fields: 4 });
    expectNoLeak(text, PHONE);
  });

  it('keeps one event per line and escapes what could mislead a viewer (T13)', () => {
    const forged = `ok\n{"level":"error"}\r${ESCAPE}[31m${LINE_SEPARATOR}${RIGHT_TO_LEFT_OVERRIDE}${C1_CONTROL}end`;
    const { text, line } = write({ fields: { note: forged } });
    for (const raw of ['\n', '\r', ESCAPE, LINE_SEPARATOR, RIGHT_TO_LEFT_OVERRIDE, C1_CONTROL]) {
      expect(text).not.toContain(raw);
    }
    expect(text).toContain(`${BACKSLASH}u2028`);
    expect(text).toContain(`${BACKSLASH}u009b`);
    expect(line.level).toBe('info');
    expect(String(line.fields?.['note']).startsWith('ok\n{"level":"error"}')).toBe(true);
  });

  it('writes at most 64 fields and counts the rest (T15)', () => {
    const fields = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [`f_${String(index)}`, index]),
    );
    const { line } = write({ fields });
    expect(Object.keys(line.fields ?? {})).toHaveLength(LOG_MAX_FIELDS);
    expect(line.problems).toEqual({ dropped_fields: 36 });
  });

  it('keeps the worst-case line inside the byte budget (T15)', () => {
    const wide = fromCodes(0x915).repeat(SCRUB_MAX_INPUT_LENGTH);
    const fields = Object.fromEntries(
      Array.from({ length: 80 }, (_, index) => [
        `${'k'.repeat(60)}_${String(index).padStart(2, '0')}`,
        wide,
      ]),
    );
    const error = coreError('VALIDATION_FAILED', {
      detail: wide,
      fields: Array.from({ length: 30 }, () => ({ path: wide, code: 'c'.repeat(64) })),
      cause: new Error('deep', { cause: new Error('deeper') }),
    });
    const via = { kind: 'ai_client', clientId: 'c'.repeat(256), scopes: ['read', 'write'] };
    const actor = { kind: 'user', userId: USER, via } as unknown as Actor;
    const ctx = deriveContext(tenantContext(actor), { causationId: JOB, actor });
    const { text, line } = write({ fields, error }, ctx, 'e'.repeat(128));
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(LOG_MAX_LINE_BYTES);
    // An error summary over half the budget is cut to types and codes, so fields still fit.
    expect(line.error).toEqual({
      type: 'AppError',
      code: 'VALIDATION_FAILED',
      status: 400,
      retryable: false,
      cause: { type: 'Error', cause: { type: 'Error' } },
    });
    expect(line.problems?.['error_compacted']).toBe(true);
    expect(Number(line.problems?.['dropped_fields'])).toBeGreaterThan(16);
    expect(Object.keys(line.fields ?? {}).length).toBeGreaterThan(0);
  });
});

describe('createLogger: errors on a line', () => {
  it('writes the error summary, never the raw error (T6)', () => {
    const database = new DatabaseError(`duplicate ${PHONE}`, 'Key (email)=(seed@example.com)');
    const error = coreError('INTERNAL', { detail: 'insert failed', cause: database });
    const { text, line } = write({ error });
    expect(line.error?.type).toBe('AppError');
    expect(line.error?.code).toBe('INTERNAL');
    expect(line.error?.detail).toBe('insert failed');
    expect(line.error?.cause?.code).toBe('23505');
    expect(line.error?.cause?.frames?.length).toBeGreaterThan(0);
    expect(line.problems).toBeUndefined();
    expect(text).not.toContain('Something went wrong');
    expectNoLeak(text, PHONE);
    expectNoLeak(text, 'seed@example.com');
  });
});

describe('createLogger: never in the way', () => {
  it('skips lines below the minimum level, which defaults to info', () => {
    const lines: string[] = [];
    const logger = createLogger({ sink: (line) => lines.push(line), classification: lookup });
    logger.debug(tenantContext(), 'cache.hit');
    logger.info(tenantContext(), 'cache.miss');
    expect(lines).toHaveLength(1);
    const quiet = capture({ minLevel: 'error' });
    quiet.logger.warn(tenantContext(), 'slow.query');
    quiet.logger.error(tenantContext(), 'query.failed');
    expect(quiet.lines).toHaveLength(1);
  });

  it('redacts the same way at debug and at error, and has no switch to turn it off (T18)', () => {
    const options = { raw: true, redact: false, unsafe: true } as Partial<LoggerOptions>;
    const { lines, logger } = capture(options);
    const fields: LogFields = { note: `call ${PHONE}`, password: 'hunter2' };
    logger.debug(tenantContext(), 'job.updated', { fields });
    logger.error(tenantContext(), 'job.updated', { fields });
    const [debug, error] = lines.map((text) => JSON.parse(text) as ParsedLine);
    expect(debug?.fields).toEqual({ note: 'call [number]', password: '[secret]' });
    expect(error?.fields).toEqual(debug?.fields);
  });

  it('reports a throwing sink once and returns (T16)', () => {
    const failure = new Error('disk full');
    const causes: unknown[] = [];
    const logger = createLogger({
      sink: () => {
        throw failure;
      },
      classification: lookup,
      onSinkError: (cause) => causes.push(cause),
    });
    expect(() => {
      logger.info(tenantContext(), 'job.updated');
    }).not.toThrow();
    expect(causes).toEqual([failure]);
  });

  it('reports a sink that rejects, and the log call does not wait for it (review M1)', async () => {
    const failure = new Error('sink down');
    const causes: unknown[] = [];
    const logger = createLogger({
      sink: () => Promise.reject(failure),
      classification: lookup,
      onSinkError: (cause) => causes.push(cause),
    });
    logger.info(tenantContext(), 'job.updated');
    expect(causes).toEqual([]);
    await Promise.resolve();
    await Promise.resolve();
    expect(causes).toEqual([failure]);
  });

  it('stops a reporter that logs to a rejecting sink after one round (review M1)', async () => {
    let reports = 0;
    let writes = 0;
    const looping = createLogger({
      sink: () => {
        writes += 1;
        return Promise.reject(new Error('sink down'));
      },
      classification: lookup,
      onSinkError: () => {
        reports += 1;
        looping.error(tenantContext(), 'sink.failed');
      },
    });
    looping.error(tenantContext(), 'job.failed');
    for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
    expect(reports).toBe(1);
    expect(writes).toBe(2);
  });

  it('survives a sink that returns a hostile thenable', () => {
    const logger = createLogger({
      sink: () => ({
        get then(): never {
          throw new Error('trap');
        },
      }),
      classification: lookup,
    });
    expect(() => {
      logger.info(tenantContext(), 'job.updated');
    }).not.toThrow();
  });

  it('writes the same line when Object.prototype.toJSON is polluted (review L6)', () => {
    const fields: LogFields = { note: 'kept' };
    const data: LogData = { fields, error: coreError('INTERNAL', { cause: new Error('x') }) };
    const clean = write(data).text;
    const prototypes = [Object.prototype, Array.prototype] as { toJSON?: () => string }[];
    try {
      for (const prototype of prototypes) prototype.toJSON = (): string => 'PWNED';
      expect(write(data).text).toBe(clean);
    } finally {
      for (const prototype of prototypes) delete prototype.toJSON;
    }
  });

  it('survives a reporter that throws and one that logs again (T16)', () => {
    const throwing = createLogger({
      sink: () => {
        throw new Error('disk full');
      },
      classification: lookup,
      onSinkError: () => {
        throw new Error('reporter down');
      },
    });
    expect(() => {
      throwing.error(tenantContext(), 'job.failed');
    }).not.toThrow();

    let reports = 0;
    const looping = createLogger({
      sink: () => {
        throw new Error('disk full');
      },
      classification: lookup,
      onSinkError: () => {
        reports += 1;
        looping.error(tenantContext(), 'sink.failed');
      },
    });
    looping.error(tenantContext(), 'job.failed');
    expect(reports).toBe(1);
    looping.error(tenantContext(), 'job.failed');
    expect(reports).toBe(2);
  });

  it('writes ts null when the clock throws or is not a number (T16)', () => {
    const broken = (nowMillis: () => number): Context => ({
      ...tenantContext(),
      clock: { nowMillis, monotonicMillis: () => 0 },
    });
    const throws = write(
      undefined,
      broken(() => {
        throw new Error('no clock');
      }),
    ).line;
    expect(throws.ts).toBeNull();
    expect(throws.problems).toEqual({ clock_failed: true });
    expect(
      write(
        undefined,
        broken(() => Number.NaN),
      ).line.ts,
    ).toBeNull();
    expect(
      write(
        undefined,
        broken(() => 9e15),
      ).line.ts,
    ).toBeNull();
  });

  it('still writes a line when the fields cannot be listed or read (T16)', () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys: (): never => {
          throw new Error('trap');
        },
      },
    ) as LogFields;
    const listed = write({ fields: hostile }).line;
    expect(listed.fields).toBeUndefined();
    expect(listed.problems).toEqual({ dropped_fields: 1 });

    const getter = Object.defineProperty({ ok_key: 1 }, 'bad_key', {
      enumerable: true,
      get: (): never => {
        throw new Error('trap');
      },
    }) as LogFields;
    expect(write({ fields: getter }).line.fields).toEqual({
      ok_key: 1,
      bad_key: '[omitted:unreadable]',
    });

    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    const revoked = { a_value: revocable.proxy } as unknown as LogFields;
    expect(write({ fields: revoked }).line.fields).toEqual({ a_value: '[omitted:unreadable]' });
    expect(write({ fields: 'not an object' as unknown as LogFields }).line.problems).toEqual({
      dropped_fields: 1,
    });
  });

  it('writes a fallback line with the ids when the payload cannot be read (requirement 8)', () => {
    const data = Object.defineProperty({}, 'fields', {
      get: (): never => {
        throw new Error('trap');
      },
    }) as LogData;
    const { line } = write(data);
    expect(line.redaction_failed).toBe(true);
    expect(line.correlation_id).toBe('req-1');
    expect(line.tenant_id).toBe(TENANT);
    expect(line.event).toBe('job.updated');
    expect(line.fields).toBeUndefined();
  });

  it('writes a line even without a context', () => {
    const { line } = write(undefined, null as unknown as Context);
    expect(line.correlation_id).toBe('[invalid]');
    expect(line.tenant_id).toBe('[invalid]');
    expect(line.actor).toEqual({ kind: '[invalid]' });
    expect(line.ts).toBeNull();
  });

  it('refuses to be created without a sink, a lookup, a known level or a valid module', () => {
    const sink = (): void => undefined;
    expect(() => createLogger({ sink: undefined as never, classification: lookup })).toThrow(
      TypeError,
    );
    expect(() => createLogger({ sink, classification: {} as never })).toThrow(TypeError);
    expect(() =>
      createLogger({ sink, classification: lookup, minLevel: 'trace' as never }),
    ).toThrow(TypeError);
    expect(() =>
      createLogger({ sink, classification: lookup, module: 'Not Valid' as never }),
    ).toThrow(TypeError);
  });
});
