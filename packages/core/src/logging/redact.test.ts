import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { coreError } from '../errors.ts';
import { Secret } from '../ports/secret.ts';
import { LIMITS, isSecretKey, redactString, redactValue, summariseError } from './redact.ts';

// Seeded values are synthetic: test-range phone numbers, example.com addresses, made-up ids.
const NATIONAL_ID_TOKEN = '[aadhaar]'; // privacycheck:ignore (the redaction token)
const DIGIT_RUN = /\d{4,}/;

describe('redactString: personal data (F-02-AC3)', () => {
  it.each([
    ['+91 98765 43210', '[phone]'],
    ['+91-9876543210', '[phone]'],
    ['+919876543210', '[phone]'],
    ['09876543210', '[phone]'],
    ['9876543210', '[phone]'],
    ['98765-43210', '[phone]'],
    ['98765 43210', '[phone]'],
    ['ravi.kumar+leads@example.co.in', '[email]'],
    ['A.B_c-d@sub.example.com', '[email]'],
    ['ravi.kumar@okaxis', '[upi]'],
    ['9876543210@ybl', '[upi]'],
    ['ABCPK1234F', '[pan]'],
    ['27ABCPK1234F1Z5', '[gstin]'],
    ['2345 6789 0123', NATIONAL_ID_TOKEN],
    ['2345-6789-0123', NATIONAL_ID_TOKEN],
    ['234567890123', NATIONAL_ID_TOKEN],
    ['123456789012345', '[number]'],
    ['4111 1111 1111 1111', '[number]'],
    ['4111-1111-1111-1111-2222', '[number]'],
  ])('masks %s as %s', (seed, token) => {
    expect(redactString(seed)).toBe(token);
    expect(redactString(`before ${seed} after`)).toBe(`before ${token} after`);
  });

  it('leaves no digit of a national id or card behind, in any grouping', () => {
    for (const seed of ['2345 6789 0123', '2345-6789-0123', '4111 1111 1111 1111 2222']) {
      expect(redactString(`id: ${seed}.`)).not.toMatch(DIGIT_RUN);
    }
  });

  it('masks every value in a sentence that holds several', () => {
    const text =
      'Lead Ravi (ravi@example.com, +91 98765 43210, PAN ABCPK1234F) paid via ravi@okicici';
    expect(redactString(text)).toBe('Lead Ravi ([email], [phone], PAN [pan]) paid via [upi]');
  });

  it('keeps short numbers, amounts, ISO timestamps and record ids readable', () => {
    for (const text of [
      'invoice 1042 for 125000 paise',
      '2026-11-05T12:30:00.000Z',
      '0190f3e2-7a1b-7c3d-8e4f-234567890123',
      'sha 3f2a9b0c1d4e5f60718293a4b5c6d7e8f9012345',
      'etag a1234567890b',
      'retry 3 of 5 after 250 ms',
    ]) {
      expect(redactString(text)).toBe(text);
    }
  });

  it('still masks personal data next to a record id', () => {
    expect(redactString('0190f3e2-7a1b-7c3d-8e4f-000000000001 phone 9876543210')).toBe(
      '0190f3e2-7a1b-7c3d-8e4f-000000000001 phone [phone]',
    );
  });

  it('never emits a hash or digest of a value, only type tokens', () => {
    const out = redactString('9876543210 ravi@example.com ABCPK1234F');
    expect(out).not.toMatch(/[0-9a-f]{16,}/i);
    expect(out).toBe('[phone] [email] [pan]');
  });
});

describe('redactString: credentials', () => {
  it('drops URL query and fragment values but keeps the names', () => {
    expect(redactString('GET https://x.example/cb?token=abc123&code=1#access_token=zz9')).toBe(
      'GET https://x.example/cb?token=[redacted]&code=[redacted]#access_token=[redacted]',
    );
  });

  it('drops query values from relative paths too', () => {
    expect(redactString('/api/leads?ref=9876543210&page=2')).toBe(
      '/api/leads?ref=[redacted]&page=[redacted]',
    );
  });

  it('masks bearer and basic credentials and JSON web tokens', () => {
    expect(redactString('Authorization: Bearer abcdefgh.ijkl-mnop')).toBe(
      'Authorization: Bearer [secret]',
    );
    expect(redactString('basic dXNlcjpwYXNzd29yZA==')).toBe('basic [secret]');
    expect(redactString('jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl')).toBe(
      'jwt [secret]',
    );
  });
});

describe('redactString: cost bounds', () => {
  it('truncates before matching and says how much it dropped', () => {
    const out = redactString('a'.repeat(LIMITS.string + 10));
    expect(out).toBe(`${'a'.repeat(LIMITS.string)}…[truncated 10 chars]`);
  });

  it.each([
    ['digits', '9'.repeat(65_536)],
    ['digits and spaces', '98765 '.repeat(11_000)],
    ['an almost-email', `${'a'.repeat(32_000)}@${'b-'.repeat(16_000)}`],
    ['an almost-query', `?${'a'.repeat(65_536)}`],
    ['an almost-token', `eyJ${'a'.repeat(65_536)}`],
    ['a near-PAN run', 'ABCDE1234'.repeat(7_000)],
  ])('handles 64 KB of %s inside the budget', (_label, input) => {
    const started = performance.now();
    redactString(input);
    expect(performance.now() - started).toBeLessThan(100);
  });
});

describe('isSecretKey', () => {
  it.each([
    'password',
    'passwd',
    'PASSCODE',
    'clientSecret',
    'access_token',
    'Authorization',
    'set-cookie',
    'otp',
    'pin',
    'x-signature',
    'apiKey',
    'api_key',
    'private_key',
    'credentials',
    'sessionId',
    'body',
    'raw_body',
  ])('treats %s as secret', (key) => {
    expect(isSecretKey(key)).toBe(true);
  });

  it.each(['invoiceId', 'amount_paise', 'status', 'pinned', 'tenant_id'])(
    'leaves %s alone',
    (key) => {
      expect(isSecretKey(key)).toBe(false);
    },
  );
});

describe('summariseError', () => {
  it('keeps the type and SQLSTATE of a driver error, never its message or detail', () => {
    const driver = Object.assign(new Error('duplicate key: Key (phone)=(9876543210) exists'), {
      name: 'DatabaseError',
      code: '23505',
      detail: 'Key (phone)=(9876543210) already exists.',
      cause: Object.assign(new TypeError('row ravi@example.com'), { code: 'ERR_INVALID_ARG' }),
    });
    const summary = summariseError(driver);
    expect(summary).toEqual({
      type: 'DatabaseError',
      code: '23505',
      cause: { type: 'TypeError', code: 'ERR_INVALID_ARG' },
    });
    expect(JSON.stringify(summary)).not.toMatch(/9876543210|ravi/);
  });

  it('drops a code or type name that does not look like one', () => {
    const odd = Object.assign(new Error('x'), { name: 'Ravi 9876543210', code: 'call 9876543210' });
    expect(summariseError(odd)).toEqual({ type: 'Error' });
  });

  it('caps the cause chain', () => {
    let error: Error = new Error('root');
    for (let index = 0; index < 10; index += 1) error = new Error('wrap', { cause: error });
    let depth = 0;
    let node: unknown = summariseError(error);
    while (typeof node === 'object' && node !== null && 'cause' in node) {
      node = node.cause;
      depth += 1;
    }
    expect(depth).toBe(LIMITS.causes - 1);
  });

  it('never invokes a getter on name, code or cause', () => {
    let calls = 0;
    const hostile = new Error('x');
    for (const key of ['name', 'code', 'cause']) {
      Object.defineProperty(hostile, key, {
        get() {
          calls += 1;
          return '9876543210';
        },
      });
    }
    expect(summariseError(hostile)).toEqual({ type: 'Error' });
    expect(calls).toBe(0);
  });

  it('summarises a thrown non-error by its type', () => {
    expect(summariseError('9876543210')).toEqual({ type: 'string' });
    expect(summariseError(undefined)).toEqual({ type: 'undefined' });
  });
});

describe('redactValue', () => {
  it('redacts strings, keys and bigints, and keeps safe scalars', () => {
    expect(
      redactValue({
        note: 'call 9876543210',
        'ravi@example.com': 1,
        big: 9876543210n,
        count: 3,
        ok: true,
        missing: undefined,
        nothing: null,
        nan: Number.NaN,
      }),
    ).toEqual({
      note: 'call [phone]',
      '[email]': 1,
      big: '[phone]',
      count: 3,
      ok: true,
      nothing: null,
      nan: 'NaN',
    });
  });

  it('removes values under secret-looking keys, at any depth', () => {
    expect(
      redactValue({ headers: { authorization: 'Bearer x', cookie: 'sid=1' }, password: 'p' }),
    ).toEqual({
      headers: { authorization: '[redacted]', cookie: '[redacted]' },
      password: '[redacted]',
    });
  });

  it('prints a Secret as [secret] and never reveals it', () => {
    expect(redactValue({ key: new Secret('s3cr3t-value'), list: [new Secret('other')] })).toEqual({
      key: '[secret]',
      list: ['[secret]'],
    });
  });

  it('summarises an AppError cause and backstops its detail', () => {
    const error = coreError('INTERNAL', {
      detail: 'insert failed for 9876543210',
      cause: Object.assign(new Error('Key (email)=(ravi@example.com)'), { code: '23505' }),
    });
    const out = JSON.stringify(redactValue({ error }));
    expect(out).not.toMatch(/9876543210|ravi@example/);
    expect(out).toContain('"cause":{"type":"Error","code":"23505"}');
    expect(out).toContain('insert failed for [phone]');
  });

  it('summarises a plain-object cause, such as a PostgREST error, by type and code only', () => {
    const cause = { message: 'Mr Ravi Kumar of Pune', details: 'free text', code: '23505' };
    expect(redactValue({ cause })).toEqual({ cause: { type: 'Object', code: '23505' } });
  });

  it('never invokes getters, toJSON or toString', () => {
    let calls = 0;
    const count = (): string => {
      calls += 1;
      return '9876543210';
    };
    const object = Object.defineProperty({}, 'phone', { get: count, enumerable: true });
    const array = Object.defineProperty([1], '0', { get: count, enumerable: true });
    const withToJSON = { toJSON: count, note: 'x' };
    const key = { toString: count };
    const out = redactValue({ object, array, withToJSON, map: new Map([[key, 'v']]) });
    expect(calls).toBe(0);
    expect(out).toEqual({
      object: { phone: '[getter]' },
      array: ['[getter]'],
      withToJSON: { toJSON: '[unsupported]', note: 'x' },
      map: { '[key]': 'v' },
    });
  });

  it('converts Map, Set and Date, and names class instances without reading them', () => {
    class Customer {
      readonly phone = '9876543210';
    }
    expect(
      redactValue({
        map: new Map<unknown, unknown>([
          ['phone', '9876543210'],
          [7, 'seven'],
        ]),
        set: new Set(['ravi@example.com']),
        date: new Date(0),
        bad: new Date(Number.NaN),
        customer: new Customer(),
        nullProto: Object.assign(Object.create(null) as object, { a: 1 }),
      }),
    ).toEqual({
      map: { phone: '[phone]', 7: 'seven' },
      set: ['[email]'],
      date: '1970-01-01T00:00:00.000Z',
      bad: '[invalid date]',
      customer: '[Customer]',
      nullProto: { a: 1 },
    });
  });

  it('ignores symbol keys and turns functions and symbols into a marker', () => {
    const hidden = Symbol('phone');
    expect(redactValue({ [hidden]: '9876543210', fn: () => 1, sym: hidden })).toEqual({
      fn: '[unsupported]',
      sym: '[unsupported]',
    });
  });

  it('marks cycles and caps depth and breadth', () => {
    const cycle: Record<string, unknown> = { name: 'a' };
    cycle['self'] = cycle;
    expect(redactValue(cycle)).toEqual({ name: 'a', self: '[circular]' });

    let deep: unknown = '9876543210';
    for (let index = 0; index < LIMITS.depth + 2; index += 1) deep = { next: deep };
    expect(JSON.stringify(redactValue(deep))).toContain('[depth limit]');

    const wide = Object.fromEntries(
      Array.from({ length: LIMITS.breadth + 5 }, (_, index) => [`k${String(index)}`, index]),
    );
    const out = redactValue(wide) as Record<string, unknown>;
    expect(Object.keys(out)).toHaveLength(LIMITS.breadth + 1);
    expect(out['[omitted]']).toBe(5);

    const long = Array.from({ length: LIMITS.breadth + 3 }, (_, index) => index);
    const items = redactValue(long) as unknown[];
    expect(items).toHaveLength(LIMITS.breadth + 1);
    expect(items.at(-1)).toBe('[3 more items]');
    const bigSet = redactValue(new Set(long)) as unknown[];
    expect(bigSet.at(-1)).toBe('[3 more items]');
  });

  it('keeps a __proto__ key as data and leaves Object.prototype alone', () => {
    const payload = JSON.parse('{"__proto__": {"polluted": "9876543210"}, "a": 1}') as unknown;
    const out = redactValue(payload) as Record<string, unknown>;
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(JSON.stringify(out)).toBe('{"__proto__":{"polluted":"[phone]"},"a":1}');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('turns array holes into null and keeps the array shape', () => {
    // eslint-disable-next-line no-sparse-arrays -- the hole is the case under test
    expect(redactValue([1, , 3])).toEqual([1, null, 3]);
  });

  it('never lets a seeded value through, whatever container wraps it (property)', () => {
    const seeds = [
      '9876543210',
      '+91 98765 43210',
      'ravi.kumar@example.com',
      'ABCPK1234F',
      '27ABCPK1234F1Z5',
      '2345 6789 0123',
      'ravi@okaxis',
      'https://x.example/cb?token=leakme',
    ] as const;
    const leaks = /9876543210|98765 43210|ravi|ABCPK1234F|6789 0123|leakme/;
    const wrap = fc.constantFrom(
      'object',
      'key',
      'array',
      'map',
      'mapKey',
      'set',
      'cause',
      'appError',
      'nullProto',
    );
    fc.assert(
      fc.property(fc.constantFrom(...seeds), fc.array(wrap, { maxLength: 8 }), (seed, path) => {
        let value: unknown = seed;
        for (const kind of path) {
          switch (kind) {
            case 'object':
              value = { field: value };
              break;
            case 'key':
              value = typeof value === 'string' ? { [value]: 1 } : { field: value };
              break;
            case 'array':
              value = [0, value];
              break;
            case 'map':
              value = new Map([['field', value]]);
              break;
            case 'mapKey':
              value = new Map([[value, 1]]);
              break;
            case 'set':
              value = new Set([value]);
              break;
            case 'cause':
              value = { cause: value };
              break;
            case 'appError':
              value = coreError('INTERNAL', { cause: value });
              break;
            case 'nullProto':
              value = Object.assign(Object.create(null) as object, { field: value });
              break;
          }
        }
        expect(JSON.stringify(redactValue(value))).not.toMatch(leaks);
      }),
    );
  });
});
