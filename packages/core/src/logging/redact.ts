import { Secret } from '../ports/secret.ts';

/**
 * Redaction for logs (threat model docs/security/threat-models/K0-T04-logging.md). The
 * primary control is field classification, applied by the logger. This file is the
 * backstop that runs on every string and walks every value: personal-data patterns after
 * Unicode normalisation, credential shapes, secret and personal key names, URL and cookie
 * pairs, and a walker that never invokes getters, toJSON or toString and stops at a budget.
 */

export const LIMITS = Object.freeze({
  /** Longest string kept, in characters; matched over a slightly longer window, then clipped. */
  string: 2_048,
  depth: 6,
  /** Keys per object and items per array, Map or Set. */
  breadth: 50,
  /** Error cause chain depth. */
  causes: 3,
  /** Values visited in one redactValue call; past it the walk stops and says so. */
  nodes: 2_000,
  /** Characters of output in one redactValue call, roughly; the logger passes its line limit. */
  chars: 16_384,
  /** Longest error message kept, for the error types whose messages are kept at all. */
  message: 256,
});

/** Numbers up to this are never personal data on their own (they have at most 8 digits). */
const LARGEST_SAFE_NUMBER = 99_999_999;
/** How far past LIMITS.string a value is matched, so a cut never splits a match. */
const MATCH_WINDOW = 64;

const TOKENS = Object.freeze({
  email: '[email]',
  upi: '[upi]',
  nationalId: '[aadhaar]', // privacycheck:ignore (the redaction token itself)
  phone: '[phone]',
  pan: '[pan]',
  gstin: '[gstin]',
  number: '[number]',
  personal: '[personal]',
  redacted: '[redacted]',
  secret: '[secret]',
  budget: '[budget exceeded]',
});

// Characters are built from code points: an escape in this file's text can be mangled by
// the tools that write it, which is how a regex once broke (LEARNINGS 2026-11-05).
const cp = (code: number): string => String.fromCodePoint(code);
const span = (from: number, to: number): string => `${cp(from)}-${cp(to)}`;

/** No-break and typographic spaces, and tabs, all become a plain space before matching. */
const SPACES = new RegExp(
  `[\t${cp(0xa0)}${cp(0x1680)}${span(0x2000, 0x200a)}${cp(0x202f)}${cp(0x205f)}${cp(0x3000)}]`,
  'g',
);
/** Typographic dashes and the minus sign become a hyphen before matching. */
const DASHES = new RegExp(`[${span(0x2010, 0x2015)}${cp(0x2212)}${cp(0xfe58)}${cp(0xfe63)}]`, 'g');
const NON_ASCII_DIGIT = /(?![0-9])\p{Nd}/gu;
const DECIMAL_DIGIT = /^\p{Nd}$/u;

/** A digit from any script as its ASCII digit. Unicode digit blocks are runs of ten. */
function asciiDigit(digit: string): string {
  const code = digit.codePointAt(0) ?? 0;
  let zero = code;
  while (code - zero < 9 && zero > 0 && DECIMAL_DIGIT.test(cp(zero - 1))) zero -= 1;
  return String(code - zero);
}

/** Fullwidth forms, other scripts' digits, odd spaces and dashes, folded so patterns see them. */
function normalise(text: string): string {
  return text
    .normalize('NFKC')
    .replace(NON_ASCII_DIGIT, asciiDigit)
    .replace(SPACES, ' ')
    .replace(DASHES, '-');
}

/**
 * Credentials and personal data, most specific first. Each pattern matches a given text one
 * way only (a separator class never matches a digit), so matching stays linear; inputs are
 * clipped first. Digit patterns allow up to three separators (space, dot, slash, hyphen,
 * parentheses) between digits, and their boundaries skip separators too, so no group of a
 * longer number is left behind.
 */
const PATTERNS: readonly (readonly [RegExp, string])[] = [
  // Credentials in a URL: scheme://user:password@host.
  [/\b([A-Za-z][A-Za-z0-9+.-]{1,30}:\/\/)[^\s/?#@]{1,256}@/g, `$1${TOKENS.redacted}@`],
  [/\beyJ[A-Za-z0-9_-]{4,2048}\.[A-Za-z0-9_-]{4,2048}\.[A-Za-z0-9_-]{0,2048}/g, TOKENS.secret],
  [/\b(Bearer|Basic|Token) [A-Za-z0-9._~+/=-]{8,2048}/gi, `$1 ${TOKENS.secret}`],
  // Provider key shapes: GitHub, AWS, Stripe, Razorpay, Slack, Supabase.
  [
    /\b(?:gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}|AKIA[0-9A-Z]{16}|(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,255}|rzp_(?:live|test)_[A-Za-z0-9]{8,255}|xox[abprs]-[A-Za-z0-9-]{10,255}|sbp_[A-Za-z0-9]{20,255}|sb_secret_[A-Za-z0-9_-]{10,255})/g,
    TOKENS.secret,
  ],
  // name=value pairs: URL queries and fragments, cookies, `key=value` in free text. After
  // the credential shapes, whose base64 padding is `=`.
  [/(^|[?&#;,\s])([^\s=&#;,?"'<>]{1,128})=[^\s&#;,"'<>]{0,2048}/g, `$1$2=${TOKENS.redacted}`],
  [
    /[\p{L}\p{M}\p{N}._%+-]{1,64}@[\p{L}\p{M}\p{N}-]{1,63}(?:\.[\p{L}\p{M}\p{N}-]{1,63}){0,8}\.\p{L}{2,24}/gu,
    TOKENS.email,
  ],
  // UPI ids look like name@bank, without a dot after the @.
  [/[\p{L}\p{M}\p{N}._-]{2,64}@[A-Za-z]{2,32}(?![\p{L}\p{M}\p{N}.])/gu, TOKENS.upi],
  [
    /(?<![0-9A-Za-z])\d{2}[A-Za-z]{5}\d{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z](?![0-9A-Za-z])/g,
    TOKENS.gstin,
  ],
  // PAN: the fourth letter is the holder type (P person, C company, H HUF and so on).
  [
    /(?<![0-9A-Za-z])[A-Za-z]{3}[ABCFGHJLPTabcfghjlpt][A-Za-z]\d{4}[A-Za-z](?![0-9A-Za-z])/g,
    TOKENS.pan,
  ],
  // A +91 number first: written without separators it is also 12 digits starting 9.
  [
    /(?<!\d[ ./()-]{0,3})\+ ?\(?91\)?[ ./()-]{0,3}[6-9](?:[ ./()-]{0,3}\d){9}(?![ ./()-]{0,3}\d)/g,
    TOKENS.phone,
  ],
  // The national id (UIDAI): 12 digits, first 2 to 9, in any grouping. Removed whole (CMP-03).
  [/(?<!\d[ ./()-]{0,3})[2-9](?:[ ./()-]{0,3}\d){11}(?![ ./()-]{0,3}\d)/g, TOKENS.nationalId],
  // Indian mobile numbers: optional 0, then 10 digits starting 6 to 9.
  [
    /(?<!\d[ ./()-]{0,3})(?:0[ ./()-]{0,3})?[6-9](?:[ ./()-]{0,3}\d){9}(?![ ./()-]{0,3}\d)/g,
    TOKENS.phone,
  ],
  // Bank accounts, cards and other long numbers: 9 or more digits, taken whole. A letter
  // before is allowed (an `AC` prefix); a letter after means a hex token, which is kept.
  [/(?<!\d[ ./()-]{0,3})\d(?:[ ./()-]{0,3}\d){8,}(?![ ./()-]{0,3}\d)(?![A-Za-z])/g, TOKENS.number],
];

/** Record ids are not personal data and must stay readable; they are kept as they are. */
const UUID =
  /(?<![0-9A-Za-z])([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?![0-9A-Za-z])/i;
/** A cut that ended inside a number or a token leaves no part of it behind. */
const CUT_TAIL = /(?:\d[\d ./()-]*|\[[a-z ]*)$/;

/** The backstop for one string: normalise, match over a window, then clip. */
export function redactString(text: string): string {
  const window = text.length > LIMITS.string ? text.slice(0, LIMITS.string + MATCH_WINDOW) : text;
  // split with a capture group keeps the UUIDs at the odd indexes.
  const out = window
    .split(UUID)
    .map((part, index) => (index % 2 === 1 ? part : redactSegment(part)))
    .join('');
  if (text.length <= LIMITS.string && out.length <= LIMITS.string) return out;
  const clipped = out.slice(0, LIMITS.string).replace(CUT_TAIL, '');
  return `${clipped}…[truncated ${String(text.length - clipped.length)} chars]`;
}

function redactSegment(text: string): string {
  let out = normalise(text);
  for (const [pattern, token] of PATTERNS) out = out.replace(pattern, token);
  return out;
}

/** A key as lowercase words: `x-api-key`, `apiKey` and `API_KEY` all give `api key`. */
function keyWords(key: string): readonly string[] {
  return key
    .slice(0, 128)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '');
}

function hasPair(words: readonly string[], pairs: ReadonlySet<string>): boolean {
  return words.some((word, index) => pairs.has(`${word} ${words[index + 1] ?? ''}`));
}

const SECRET_WORDS: ReadonlySet<string> = new Set([
  'password',
  'passwd',
  'passcode',
  'pass',
  'pwd',
  'secret',
  'secrets',
  'token',
  'authorization',
  'auth',
  'cookie',
  'cookies',
  'otp',
  'pin',
  'mpin',
  'cvv', // privacycheck:ignore (a key name the backstop removes)
  'cvc', // privacycheck:ignore (a key name the backstop removes)
  'signature',
  'sig',
  'jwt',
  'dsn',
  'credential',
  'credentials',
  'apikey',
  'privatekey',
  'sessionid',
  'connectionstring',
  'body',
]);
const SECRET_PAIRS: ReadonlySet<string> = new Set([
  'api key',
  'private key',
  'session id',
  'access key',
  'connection string',
  'client secret',
]);

/** Keys whose values are never logged, whatever they hold. Matched by whole words. */
export function isSecretKey(key: string): boolean {
  const words = keyWords(key);
  return words.some((word) => SECRET_WORDS.has(word)) || hasPair(words, SECRET_PAIRS);
}

const PERSONAL_WORDS: ReadonlySet<string> = new Set([
  'name',
  'firstname',
  'lastname',
  'fullname',
  'surname',
  'phone',
  'mobile',
  'msisdn',
  'whatsapp',
  'email',
  'address',
  'dob',
  'birthdate',
  'birthday',
  'aadhaar', // privacycheck:ignore (a key name the backstop masks)
  'aadhar', // privacycheck:ignore (a key name the backstop masks)
  'pan',
  'ifsc',
  'upi',
  'vpa',
  'latitude',
  'longitude',
  'lat',
  'lng',
]);
const PERSONAL_PAIRS: ReadonlySet<string> = new Set([
  'account number',
  'account no',
  'acct no',
  'bank account',
  'date birth',
]);
/** A word that makes a key technical, so `file_name` or `email_template` is not personal. */
const TECHNICAL_WORDS: ReadonlySet<string> = new Set([
  'file',
  'event',
  'module',
  'entity',
  'field',
  'table',
  'column',
  'host',
  'type',
  'class',
  'process',
  'queue',
  'job',
  'bucket',
  'package',
  'branch',
  'plan',
  'product',
  'role',
  'permission',
  'template',
  'key',
  'index',
  'schema',
  'function',
  'method',
  'service',
  'tenant',
  'company',
  'business',
  'brand',
  'app',
  'device',
  'browser',
  'region',
  'server',
  'domain',
  'tag',
  'label',
  'step',
  'state',
  'status',
  'feature',
  'metric',
  'route',
  'path',
  'folder',
  'sheet',
  'database',
  'count',
  'verified',
]);

/** Keys that name a person's data; their values are masked even without a classification. */
export function isPersonalKey(key: string): boolean {
  const words = keyWords(key);
  if (words.some((word) => TECHNICAL_WORDS.has(word))) return false;
  return words.some((word) => PERSONAL_WORDS.has(word)) || hasPair(words, PERSONAL_PAIRS);
}

/** A key that ends in a unit (`amount_paise`, `started_at_millis`): its number is kept. */
const UNIT_WORDS: ReadonlySet<string> = new Set([
  'paise',
  'amount',
  'price',
  'cost',
  'balance',
  'total',
  'millis',
  'ms',
  'seconds',
  'secs',
  'minutes',
  'bytes',
  'count',
  'size',
  'length',
  'version',
  'attempt',
  'attempts',
  'timestamp',
  'epoch',
  'ts',
  'kwh',
  'wh',
  'kw',
  'watts',
]);

function isUnitKey(key: string): boolean {
  return UNIT_WORDS.has(keyWords(key).at(-1) ?? '');
}

const UNIT_STRING = /^-?\d{1,19}$/;

const SAFE_TYPE_NAME = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
/** A SQLSTATE (`23505`), an app or PostgREST code (`NOT_FOUND`, `PGRST116`) or `ERR_X`. */
const SAFE_CODE = /^(?:[0-9A-Z]{5}|[A-Z][A-Z0-9_]{1,63})$/;
/** Programmer errors whose messages name code, not data; the message still gets the backstop. */
const MESSAGE_KEPT: ReadonlySet<string> = new Set(['TypeError', 'RangeError', 'ReferenceError']);

/**
 * An error, summarised: its type name and a stable code; for TypeError, RangeError and
 * ReferenceError also the redacted message. Never another message, a detail or the stack:
 * a driver message can quote the offending row, and SyntaxError quotes its input.
 */
export function summariseError(error: unknown, depth = 0): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  try {
    const name =
      typeof error === 'object' && error !== null
        ? (ownValue(error, 'name') ?? constructorName(error))
        : typeof error;
    summary['type'] = typeof name === 'string' && SAFE_TYPE_NAME.test(name) ? name : 'Error';
    const code = ownValue(error, 'code');
    if (typeof code === 'string' && SAFE_CODE.test(code)) summary['code'] = code;
    const message = ownValue(error, 'message');
    const builtIn = error instanceof Error ? constructorName(error) : undefined;
    if (typeof message === 'string' && typeof builtIn === 'string' && MESSAGE_KEPT.has(builtIn)) {
      summary['message'] = redactString(message.slice(0, LIMITS.message));
    }
    const cause = ownValue(error, 'cause');
    if (cause !== undefined && depth + 1 < LIMITS.causes) {
      summary['cause'] = summariseError(cause, depth + 1);
    }
  } catch {
    summary['type'] = 'Error';
  }
  return summary;
}

/** An own data property's value, without invoking a getter. */
function ownValue(value: unknown, key: string): unknown {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return undefined;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor
    ? (descriptor.value as unknown)
    : undefined;
}

/** The class name from the prototype chain, read without getters. */
function constructorName(value: object): unknown {
  let proto = Object.getPrototypeOf(value) as unknown;
  for (let hops = 0; hops < 8 && typeof proto === 'object' && proto !== null; hops += 1) {
    const ctor = ownValue(proto, 'constructor');
    if (typeof ctor === 'function') {
      const name = ownValue(ctor, 'name');
      if (typeof name === 'string' && name !== '') return name;
    }
    proto = Object.getPrototypeOf(proto) as unknown;
  }
  return undefined;
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * A plain object shaped like a driver or PostgREST error (`code` and `message`), which is
 * summarised like an Error. An AppError (numeric `status`, boolean `retryable`) is not: its
 * fields are meant for logs and are walked, with `detail` backstopped and `cause` summarised.
 */
function isErrorLike(value: object): boolean {
  const code = ownValue(value, 'code');
  const message = ownValue(value, 'message');
  if (typeof code !== 'string' || typeof message !== 'string') return false;
  const isAppError =
    typeof ownValue(value, 'status') === 'number' &&
    typeof ownValue(value, 'retryable') === 'boolean';
  return !isAppError;
}

const GETTER = Symbol('getter');

/** An own property read without invoking a getter: its value, GETTER, or undefined if absent. */
function readOwn(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined) return undefined;
  return 'value' in descriptor ? (descriptor.value as unknown) : GETTER;
}

/** At most `limit + 1` items, so the caller can tell that some were left out. */
function take<T>(items: Iterable<T>, limit: number): T[] {
  const out: T[] = [];
  for (const item of items) {
    out.push(item);
    if (out.length > limit) break;
  }
  return out;
}

/** A Map key as a log key: primitives only; an object key never has its toString called. */
function mapKey(key: unknown): string {
  switch (typeof key) {
    case 'string':
      return key;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(key);
    case 'undefined':
      return 'undefined';
    case 'symbol':
    case 'function':
    case 'object':
      return key === null ? 'null' : '[key]';
  }
}

/** Sets a key as an own property, so `__proto__` is kept as data and never swaps a prototype. */
function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

export interface RedactOptions {
  /** Values visited before the walk stops; defaults to LIMITS.nodes. */
  readonly maxNodes?: number;
  /** Characters of output before the walk stops, roughly; defaults to LIMITS.chars. */
  readonly maxChars?: number;
  /**
   * Top-level keys a classification lookup already decided on, so the personal-key backstop
   * does not override it (a product's `name` is public). Secret-looking keys are still removed.
   */
  readonly classifiedKeys?: ReadonlySet<string>;
}

interface Walk {
  nodes: number;
  chars: number;
  exhausted: boolean;
  readonly maxNodes: number;
  readonly maxChars: number;
  readonly classifiedKeys: ReadonlySet<string>;
  /** Objects on the path from the root: a value seen here is a cycle, elsewhere just shared. */
  readonly ancestors: Set<object>;
}

/**
 * Turns any value into something safe to serialise. Strings go through the backstop;
 * values under secret-looking keys are removed and under personal keys masked; numbers of
 * 9 or more digits are backstopped unless their key ends in a unit; error-shaped values are
 * summarised; Secret is `[secret]`; getters, toJSON and toString are never called; cycles,
 * depth, breadth, total nodes and output size are capped. A hostile Proxy can still throw:
 * the logger catches that and writes a fallback line.
 */
export function redactValue(value: unknown, options: RedactOptions = {}): unknown {
  return walk(value, 0, {
    nodes: 0,
    chars: 0,
    exhausted: false,
    maxNodes: options.maxNodes ?? LIMITS.nodes,
    maxChars: options.maxChars ?? LIMITS.chars,
    classifiedKeys: options.classifiedKeys ?? new Set(),
    ancestors: new Set(),
  });
}

/** Counts one value against the budget; false once the budget is spent. */
function spend(state: Walk, chars: number): boolean {
  state.nodes += 1;
  state.chars += chars;
  if (state.nodes > state.maxNodes || state.chars > state.maxChars) state.exhausted = true;
  return !state.exhausted;
}

function redactNumber(value: number): number | string {
  if (!Number.isFinite(value)) return String(value);
  return Math.abs(value) > LARGEST_SAFE_NUMBER ? redactString(String(value)) : value;
}

function walk(value: unknown, depth: number, state: Walk): unknown {
  switch (typeof value) {
    case 'string': {
      const out = redactString(value);
      return spend(state, out.length + 2) ? out : TOKENS.budget;
    }
    case 'number':
      spend(state, 12);
      return redactNumber(value);
    case 'boolean':
      spend(state, 5);
      return value;
    case 'bigint':
      spend(state, 12);
      return redactString(value.toString());
    case 'undefined':
      return undefined;
    case 'symbol':
    case 'function':
      spend(state, 13);
      return '[unsupported]';
    case 'object':
      break;
  }
  if (value === null) return null;
  if (!spend(state, 2)) return TOKENS.budget;
  if (value instanceof Secret) return TOKENS.secret;
  if (value instanceof Error) return summariseError(value);
  if (value instanceof Date) {
    const time = Date.prototype.getTime.call(value);
    return Number.isNaN(time) ? '[invalid date]' : new Date(time).toISOString();
  }
  if (state.ancestors.has(value)) return '[circular]';
  if (depth >= LIMITS.depth) return '[depth limit]';
  state.ancestors.add(value);
  try {
    return walkContainer(value, depth, state);
  } finally {
    state.ancestors.delete(value);
  }
}

function walkContainer(value: object, depth: number, state: Walk): unknown {
  if (Array.isArray(value)) {
    const length = value.length;
    const items: unknown[] = [];
    for (let index = 0; index < Math.min(length, LIMITS.breadth); index += 1) {
      items.push(readOwn(value, String(index)));
    }
    return walkItems(items, length, depth, state);
  }
  if (value instanceof Set) {
    return walkItems(take(value.values(), LIMITS.breadth), value.size, depth, state);
  }
  if (value instanceof Map) {
    const entries = take(value.entries(), LIMITS.breadth).map(
      ([key, item]) => [mapKey(key), item] as const,
    );
    return walkEntries(entries, value.size, depth, state);
  }
  if (!isPlainObject(value)) {
    const name = constructorName(value);
    return `[${typeof name === 'string' && SAFE_TYPE_NAME.test(name) ? name : 'object'}]`;
  }
  if (isErrorLike(value)) return summariseError(value);
  const keys = Object.keys(value);
  const entries = keys.slice(0, LIMITS.breadth).map((key) => [key, readOwn(value, key)] as const);
  return walkEntries(entries, keys.length, depth, state);
}

/** Array items; an item after a secret-looking name (`['Cookie', 'sid=1']`) is removed. */
function walkItems(
  items: readonly unknown[],
  total: number,
  depth: number,
  state: Walk,
): unknown[] {
  const out: unknown[] = [];
  let previous: unknown;
  for (const item of items.slice(0, LIMITS.breadth)) {
    if (state.exhausted) {
      out.push(TOKENS.budget);
      return out;
    }
    if (item === GETTER) out.push('[getter]');
    else if (typeof previous === 'string' && isSecretKey(previous)) out.push(TOKENS.redacted);
    else out.push(walk(item, depth + 1, state) ?? null);
    previous = item;
  }
  if (total > LIMITS.breadth) out.push(`[${String(total - LIMITS.breadth)} more items]`);
  return out;
}

function walkEntries(
  entries: readonly (readonly [string, unknown])[],
  total: number,
  depth: number,
  state: Walk,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of entries.slice(0, LIMITS.breadth)) {
    if (state.exhausted) {
      setOwn(out, '[truncated]', TOKENS.budget);
      return out;
    }
    const safeKey = redactString(key);
    state.chars += safeKey.length + 3;
    const classified = depth === 0 && state.classifiedKeys.has(key);
    const value = entryValue(key, field, depth, state, classified);
    if (value !== undefined) setOwn(out, safeKey, value);
  }
  if (total > LIMITS.breadth) setOwn(out, '[omitted]', total - LIMITS.breadth);
  return out;
}

function entryValue(
  key: string,
  field: unknown,
  depth: number,
  state: Walk,
  classified: boolean,
): unknown {
  if (field === GETTER) return '[getter]';
  if (isSecretKey(key)) return TOKENS.redacted;
  if (key === 'cause') return summariseError(field);
  if (isUnitKey(key)) {
    if (typeof field === 'number' || typeof field === 'bigint') {
      spend(state, 12);
      return typeof field === 'bigint' ? field.toString() : field;
    }
    if (typeof field === 'string' && UNIT_STRING.test(field)) {
      spend(state, field.length + 2);
      return field;
    }
  }
  if (
    !classified &&
    isPersonalKey(key) &&
    field !== null &&
    field !== undefined &&
    typeof field !== 'boolean'
  ) {
    spend(state, 12);
    return TOKENS.personal;
  }
  return walk(field, depth + 1, state);
}
