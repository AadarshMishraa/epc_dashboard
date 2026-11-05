import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { coreError } from '../errors.ts';
import { Secret } from '../ports/secret.ts';
import {
  LIMITS,
  isPersonalKey,
  isSecretKey,
  redactString,
  redactValue,
  summariseError,
} from './redact.ts';

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
      'Authorization: [redacted]',
    );
    expect(redactString('sent Bearer abcdefgh.ijkl-mnop upstream')).toBe(
      'sent Bearer [secret] upstream',
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
      cause: { type: 'TypeError', code: 'ERR_INVALID_ARG', message: 'row [email]' },
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
          ['note', '9876543210'],
          [7, 'seven'],
        ]),
        set: new Set(['ravi@example.com']),
        date: new Date(0),
        bad: new Date(Number.NaN),
        customer: new Customer(),
        nullProto: Object.assign(Object.create(null) as object, { a: 1 }),
      }),
    ).toEqual({
      map: { note: '[phone]', 7: 'seven' },
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
    const cycle: Record<string, unknown> = { label: 'a' };
    cycle['self'] = cycle;
    expect(redactValue(cycle)).toEqual({ label: 'a', self: '[circular]' });

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

// Security review of K0-T04 (2026-11-05): one block per finding.
describe('review H1: numbers are personal data too', () => {
  it('backstops integers of 9 or more digits and keeps smaller ones', () => {
    expect(
      redactValue({
        contact: 9876543210,
        ref: 234567890123,
        account: 123456789012345,
        big: 9876543210n,
        invoice: 1042,
        largest: 99_999_999,
      }),
    ).toEqual({
      contact: '[phone]',
      ref: NATIONAL_ID_TOKEN,
      account: '[number]',
      big: '[phone]',
      invoice: 1042,
      largest: 99_999_999,
    });
  });

  it('keeps numbers under a key that ends in a unit, so amounts and times stay readable', () => {
    expect(
      redactValue({
        amount_paise: 9_876_543_210,
        totalPaise: 12_345_678_901n,
        started_at_millis: 1_762_300_000_000,
        grand_total: '125000000000',
        size_bytes: 234_567_890_123,
      }),
    ).toEqual({
      amount_paise: 9_876_543_210,
      totalPaise: '12345678901',
      started_at_millis: 1_762_300_000_000,
      grand_total: '125000000000',
      size_bytes: 234_567_890_123,
    });
  });

  it('still backstops a non-numeric string under a unit key', () => {
    expect(redactValue({ amount: 'paid by 9876543210' })).toEqual({ amount: 'paid by [phone]' });
  });
});

describe('review H2: real-world formats', () => {
  const nbsp = String.fromCharCode(0xa0);
  const enDash = String.fromCharCode(0x2013);
  const devanagari = Array.from('9876543210', (d) => String.fromCharCode(0x966 + Number(d))).join(
    '',
  );
  const fullwidth = Array.from('9876543210', (d) => String.fromCharCode(0xff10 + Number(d))).join(
    '',
  );

  it.each([
    ['dotted id', '2345.6789.0123', NATIONAL_ID_TOKEN],
    ['slashed id', '2345/6789/0123', NATIONAL_ID_TOKEN],
    ['double-spaced id', '2345  6789  0123', NATIONAL_ID_TOKEN],
    ['id with no-break spaces', `2345${nbsp}6789${nbsp}0123`, NATIONAL_ID_TOKEN],
    ['id grouped 2-4-6', '23 4567 890123', NATIONAL_ID_TOKEN],
    ['dotted +91', '+91.98765.43210', '[phone]'],
    ['3-3-4 phone', '987.654.3210', '[phone]'],
    ['en-dash phone', `98765${enDash}43210`, '[phone]'],
    ['Devanagari digits', devanagari, '[phone]'],
    ['fullwidth digits', fullwidth, '[phone]'],
    ['lowercase PAN', 'abcpk1234f', '[pan]'],
    ['lowercase GSTIN', '27abcpk1234f1z5', '[gstin]'],
    ['Devanagari email', 'रवि@example.com', '[email]'],
  ])('masks a %s', (_label, seed, token) => {
    expect(redactString(`x ${seed} y`)).toBe(`x ${token} y`);
  });

  it('masks a bracketed phone and an account number glued to letters, leaving no digits', () => {
    expect(redactString('(98765) 43210')).not.toMatch(/\d/);
    expect(redactString('AC12345678901')).toBe('AC[number]');
  });

  it('keeps a hex token whose digits run into letters', () => {
    expect(redactString('etag a1234567890b')).toBe('etag a1234567890b');
  });
});

describe('review M1: credentials', () => {
  it('removes credentials from connection strings', () => {
    expect(redactString('postgres://app:S3cretPw@10.0.0.5:5432/epc')).toBe(
      'postgres://[redacted]@10.0.0.5:5432/epc',
    );
    expect(redactString('redis://:hunter2hunter2@10.0.0.1:6379')).toBe(
      'redis://[redacted]@10.0.0.1:6379',
    );
  });

  it('removes every value of a cookie string, the first one included', () => {
    expect(redactString('sid=abc123secretvalue; theme=dark')).toBe(
      'sid=[redacted]; theme=[redacted]',
    );
  });

  it('removes the value after a secret-looking name in a header array', () => {
    expect(
      redactValue([
        'Cookie',
        'sid=abc123secret',
        'X-Api-Key',
        'opaque-key-value',
        'Accept',
        'json',
      ]),
    ).toEqual(['Cookie', '[redacted]', 'X-Api-Key', '[redacted]', 'Accept', 'json']);
  });

  it('masks provider key shapes and Token credentials', () => {
    // Built at run time so secret scanners do not flag the fixtures.
    const keys = [
      ['gh', 'p_', 'a'.repeat(36)],
      ['AK', 'IA', 'B'.repeat(16)],
      ['sk_', 'live_', 'x'.repeat(24)],
      ['rzp_', 'test_', 'y'.repeat(14)],
      ['xo', 'xb-', '1'.repeat(12), '-abcdefghij'],
      ['sb_', 'secret_', 'z'.repeat(20)],
    ].map((parts) => parts.join(''));
    for (const key of keys) expect(redactString(`key ${key} end`)).toBe('key [secret] end');
    expect(redactString('Token abcdefghijklmnop')).toBe('Token [secret]');
  });

  it.each([
    'mpin',
    'upi_pin',
    'cvv', // privacycheck:ignore (a key name the backstop removes)
    'auth',
    'jwt',
    'dsn',
    'connectionString',
    'refreshToken',
    'stripe-signature',
  ])('treats %s as a secret key', (key) => {
    expect(isSecretKey(key)).toBe(true);
  });

  it.each(['prompt_tokens', 'passengers', 'footprint', 'author', 'pincode', 'shipping', 'compass'])(
    'does not treat %s as a secret key',
    (key) => {
      expect(isSecretKey(key)).toBe(false);
    },
  );
});

describe('review M2: one budget for the whole walk', () => {
  /** A tree of shared children: tiny to build, 50^depth nodes to walk without a budget. */
  function sharedTree(depth: number): unknown {
    let node: unknown = 'leaf';
    for (let level = 0; level < depth; level += 1) node = Array.from({ length: 50 }, () => node);
    return node;
  }

  it('stops a wide and deep tree at the budget and says so', () => {
    const started = performance.now();
    const out = JSON.stringify(redactValue(sharedTree(5)));
    expect(performance.now() - started).toBeLessThan(100);
    expect(out).toContain('[budget exceeded]');
    expect(out.length).toBeLessThan(LIMITS.chars * 2);
  });

  it('honours a smaller node or character budget', () => {
    const nodes = JSON.stringify(redactValue(sharedTree(2), { maxNodes: 10 }));
    expect(nodes.match(/leaf/g)?.length ?? 0).toBeLessThanOrEqual(10);
    const chars = JSON.stringify(
      redactValue({ a: 'x'.repeat(500), b: 'y'.repeat(500) }, { maxChars: 600 }),
    );
    expect(chars).toContain('[budget exceeded]');
  });

  it('walks a shared reference each time instead of calling it circular', () => {
    const shared = { a: 1 };
    expect(redactValue({ x: shared, y: [shared] })).toEqual({ x: { a: 1 }, y: [{ a: 1 }] });
  });
});

describe('review M3: personal keys and error-shaped objects', () => {
  it('masks values under personal keys, whatever they hold', () => {
    expect(
      redactValue({
        name: 'Ravi Kumar',
        customerName: 'Ravi Kumar',
        phone_number: 'n/a',
        email_address: 'hidden',
        account_number: 'AC-1',
        lat: 18.52,
        has_phone: true,
        dob: null,
      }),
    ).toEqual({
      name: '[personal]',
      customerName: '[personal]',
      phone_number: '[personal]',
      email_address: '[personal]',
      account_number: '[personal]',
      lat: '[personal]',
      has_phone: true,
      dob: null,
    });
  });

  it('leaves technical keys that contain a personal word alone', () => {
    expect(
      redactValue({
        file_name: 'invoice.pdf',
        event_name: 'lead.created',
        tenant_name: 'Suryakiran Solar',
        email_template: 'welcome',
        phone_count: 3,
      }),
    ).toEqual({
      file_name: 'invoice.pdf',
      event_name: 'lead.created',
      tenant_name: 'Suryakiran Solar',
      email_template: 'welcome',
      phone_count: 3,
    });
  });

  it('skips the personal-key check only for top-level keys a classification decided', () => {
    expect(
      redactValue(
        { name: 'Panel 540W', nested: { name: 'Ravi' } },
        { classifiedKeys: new Set(['name']) },
      ),
    ).toEqual({ name: 'Panel 540W', nested: { name: '[personal]' } });
  });

  it('summarises a PostgREST-style error under any key', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value',
      details: 'Key (name)=(Ravi Kumar) already exists.',
      hint: null,
    };
    expect(redactValue({ error, list: [error] })).toEqual({
      error: { type: 'Object', code: '23505' },
      list: [{ type: 'Object', code: '23505' }],
    });
  });

  it('keeps redacted messages for programmer errors only', () => {
    expect(
      summariseError(new TypeError("Cannot read properties of undefined (reading 'phone')")),
    ).toEqual({
      type: 'TypeError',
      message: "Cannot read properties of undefined (reading 'phone')",
    });
    let syntax: unknown;
    try {
      JSON.parse('Ravi 9876543210');
    } catch (error) {
      syntax = error;
    }
    expect(summariseError(syntax)).toEqual({ type: 'SyntaxError' });
  });
});

describe('review L1: truncation leaves no partial value', () => {
  it.each([
    ['a national id', ' 2345 6789 0123'],
    ['a phone', ' 98765 43210'],
    ['an email', ' ravi.kumar@example.com'],
  ])('masks %s that straddles the cut', (_label, seed) => {
    for (const offset of [-12, -6, -3, 0]) {
      const text = 'x'.repeat(LIMITS.string + offset) + seed + ' tail';
      const out = redactString(text);
      expect(out.replace(/\[truncated \d+ chars\]$/, '')).not.toMatch(/\d{2,}|ravi/);
    }
  });
});

describe('review: property test over more shapes and number leaves', () => {
  it('never lets a seeded value through', () => {
    const hidden = Symbol('hidden');
    class Holder {
      readonly value: unknown;
      constructor(value: unknown) {
        this.value = value;
      }
    }
    const leaks = /9876543210|98765.43210|234567890123|ravi|ABCPK1234F|leakme/i;
    const seeds: unknown[] = [
      9876543210,
      234567890123,
      9876543210n,
      '98765.43210',
      `2345${String.fromCharCode(0xa0)}6789${String.fromCharCode(0xa0)}0123`,
      'RAVI@example.com',
      'abcpk1234f',
      'postgres://u:leakme@db/x',
    ];
    const wrappers: ((value: unknown) => unknown)[] = [
      (v) => ({ field: v }),
      (v) => [v],
      (v) => new Map([['field', v]]),
      (v) => new Set([v]),
      (v) => Object.defineProperty({}, 'field', { get: () => v, enumerable: true }),
      (v) => ({ toJSON: () => v, field: 1 }),
      (v) => ({ [hidden]: v }),
      (v) => new Holder(v),
      (v) => ({ code: 'X1', message: String(v), details: v }),
      (v) => ({ cause: v }),
      (v) => ({ name: v, phone: v }),
    ];
    fc.assert(
      fc.property(
        fc.constantFrom(...seeds),
        fc.array(fc.integer({ min: 0, max: wrappers.length - 1 }), { maxLength: 6 }),
        (seed, path) => {
          let value = seed;
          for (const index of path) value = wrappers[index]?.(value) ?? value;
          expect(JSON.stringify(redactValue(value))).not.toMatch(leaks);
        },
      ),
    );
  });

  it('handles 64 KB of no-break spaces and other-script digits inside the budget', () => {
    const nbsp = String.fromCharCode(0xa0);
    for (const input of [`9${nbsp}`.repeat(32_000), String.fromCharCode(0x96f).repeat(65_536)]) {
      const started = performance.now();
      redactString(input);
      expect(performance.now() - started).toBeLessThan(100);
    }
  });
});

describe('review: normalisation and cut details', () => {
  const fullwidth = (text: string): string =>
    Array.from(text, (char) => String.fromCharCode(char.charCodeAt(0) + 0xfee0)).join('');

  it('folds fullwidth letters and the fullwidth @ before matching', () => {
    expect(redactString(fullwidth('ABCPK1234F'))).toBe('[pan]');
    expect(redactString(fullwidth('ravi@example.com'))).toBe('[email]');
  });

  it('treats tabs and spaces NFKC leaves alone as separators', () => {
    const ogham = String.fromCharCode(0x1680);
    expect(redactString('2345\t6789\t0123')).toBe(NATIONAL_ID_TOKEN);
    expect(redactString(`98765${ogham}43210`)).toBe('[phone]');
  });

  it('never ends a clipped string with part of a token', () => {
    for (let offset = 1; offset < 8; offset += 1) {
      const out = redactString(
        `${'x'.repeat(LIMITS.string - offset)} 9876543210 ${'y'.repeat(100)}`,
      );
      expect(out).toMatch(/(?:x|\[phone\]) ?…\[truncated \d+ chars\]$/);
    }
  });

  it('stops filling an object once the budget is spent and marks where', () => {
    const wide = Object.fromEntries(
      Array.from({ length: 50 }, (_, index) => [`k${String(index)}`, 'v'.repeat(40)]),
    );
    const out = redactValue(wide, { maxChars: 400 }) as Record<string, unknown>;
    expect(out['[truncated]']).toBe('[budget exceeded]');
    expect(Object.keys(out).length).toBeLessThan(15);
  });
});

describe('review: any cause is summarised, not only error-shaped ones', () => {
  it('summarises a string or a shapeless object under cause', () => {
    expect(
      redactValue({
        a: { cause: 'Ravi Kumar of Pune' },
        b: { cause: { details: 'Ravi Kumar of Pune', hint: 'retry' } },
      }),
    ).toEqual({ a: { cause: { type: 'string' } }, b: { cause: { type: 'Object' } } });
  });
});

// Second security review pass (2026-11-05).
describe('review 2 M1: one-word and compound secret keys', () => {
  it.each([
    'refreshtoken',
    'accesstoken',
    'apitoken',
    'csrftoken',
    'clientsecret',
    'secretkey',
    'newpassword',
    'confirmpassword',
    'userpassword',
    'accesskey',
    'otpcode',
    'upipin',
    'tpin',
    'signing_key',
    'encryption_key',
    'hmacKey',
    'webhookKey',
    'tokenId',
  ])('treats %s as secret', (key) => {
    expect(isSecretKey(key)).toBe(true);
  });

  it.each(['prompttokens', 'tokens_used', 'tokenizer', 'spin', 'mapping', 'idempotency_key'])(
    'does not treat %s as secret',
    (key) => {
      expect(isSecretKey(key)).toBe(false);
    },
  );
});

describe('review 2 M2: the technical exemption applies only next to the personal word', () => {
  it.each([
    'company_owner_name',
    'field_engineer_name',
    'job_applicant_name',
    'app_user_name',
    'tenant_admin_name',
    'branch_manager_name',
    'device_owner_name',
    'event_contact_name',
    'verified_name',
    'username',
    'displayname',
    'fathername',
    'customername',
    'phoneno',
    'emailaddress',
    'contact_person',
    'passport_no',
    'gender',
  ])('treats %s as personal', (key) => {
    expect(isPersonalKey(key)).toBe(true);
  });

  it.each([
    'file_name',
    'hostname',
    'event_name',
    'tenant_name',
    'email_template',
    'phone_count',
    'filename',
  ])('does not treat %s as personal', (key) => {
    expect(isPersonalKey(key)).toBe(false);
  });
});

describe('review 2 M3: separators normalise did not fold', () => {
  const zwsp = String.fromCharCode(0x200b);
  const joiner = String.fromCharCode(0x2060);
  const softHyphen = String.fromCharCode(0xad);
  const middleDot = String.fromCharCode(0xb7);

  it.each([
    ['zero-width spaces in a phone', `98765${zwsp}43210`, '[phone]'],
    ['zero-width spaces in an id', `2345${zwsp}6789${zwsp}0123`, NATIONAL_ID_TOKEN],
    ['a word joiner and a soft hyphen', `98765${joiner}432${softHyphen}10`, '[phone]'],
    ['newlines in a phone', '98765\n43210', '[phone]'],
    ['newlines in an id', '2345\n6789\n0123', NATIONAL_ID_TOKEN],
    ['a comma', '98765,43210', '[phone]'],
    ['an underscore', '98765_43210', '[phone]'],
    ['a middle dot', `98765${middleDot}43210`, '[phone]'],
    ['four spaces', '98765    43210', '[phone]'],
  ])('masks %s', (_label, seed, token) => {
    expect(redactString(`x ${seed} y`)).toBe(`x ${token} y`);
  });

  it('never lets a seeded value through these separators (property)', () => {
    const separators = [zwsp, joiner, softHyphen, middleDot, '\n', ',', '_', '    ', '\t', ' . '];
    fc.assert(
      fc.property(
        fc.constantFrom('9876543210', '234567890123'),
        fc.array(fc.constantFrom(...separators), { minLength: 9, maxLength: 9 }),
        fc.array(fc.boolean(), { minLength: 11, maxLength: 11 }),
        (digits, seps, use) => {
          let text = '';
          Array.from(digits).forEach((digit, index) => {
            text += digit;
            if (index < digits.length - 1 && use[index] === true)
              text += seps[index % seps.length] ?? '';
          });
          expect(redactString(`note ${text} end`)).not.toMatch(/\d{3,}/);
        },
      ),
    );
  });
});

describe('review 2 lows', () => {
  it('takes a whole parenthesised value and treats details-and-code objects as errors (L1)', () => {
    expect(redactString('Key (name)=(Ravi Kumar) already exists')).toBe(
      'Key (name)=[redacted] already exists',
    );
    expect(redactValue({ e: { code: 23505, details: 'Key (name)=(Ravi Kumar)' } })).toEqual({
      e: { type: 'Object' },
    });
  });

  it('removes passwords with unencoded / or # and colon-labelled secrets (L2)', () => {
    expect(redactString('postgres://app:pa/ss@10.0.0.5/db')).toBe(
      'postgres://[redacted]@10.0.0.5/db',
    );
    expect(redactString('postgres://app:p#ss@10.0.0.5/db')).toBe(
      'postgres://[redacted]@10.0.0.5/db',
    );
    expect(redactString('Password: S3cretHunter2 ok')).toBe('Password: [redacted] ok');
    expect(redactString('authorization: abcdef0123456789abcdef')).toBe('authorization: [redacted]');
  });

  it('checks personal keys before the unit exemption (L4)', () => {
    expect(redactValue({ aadhaar_amount: 234567890123, mobile_ts: '9876543210' })).toEqual({
      // privacycheck:ignore
      aadhaar_amount: '[personal]', // privacycheck:ignore
      mobile_ts: '[personal]',
    });
  });

  it('matches no more than the window after NFKC lengthens many strings (L5)', () => {
    // 50 strings that NFKC expands 18 times: about 60 ms with the cap, about 350 without.
    const ligatures = Array.from({ length: 50 }, () => String.fromCharCode(0xfdfa).repeat(2_000));
    const started = performance.now();
    redactValue(ligatures, { maxChars: 1e9, maxNodes: 1e9 });
    expect(performance.now() - started).toBeLessThan(250);
  });

  it('bounds the work when NFKC lengthens a string (L5)', () => {
    const ligature = String.fromCharCode(0xfdfa);
    const started = performance.now();
    const out = redactString(ligature.repeat(2_100));
    expect(performance.now() - started).toBeLessThan(50);
    expect(out.length).toBeLessThanOrEqual(LIMITS.string + 40);
  });
});
