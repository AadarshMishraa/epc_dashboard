import { Secret } from '../ports/secret.ts';

/**
 * Redaction for logs (threat model docs/security/threat-models/K0-T04-logging.md). The
 * primary control is field classification, applied by the logger. This file is the
 * backstop that runs on every string and walks every value: personal-data patterns,
 * credential shapes, secret-looking keys, URL query and fragment values, and a walker that
 * never invokes getters, toJSON or toString.
 */

export const LIMITS = Object.freeze({
  /** Longest string kept, in characters; matched only after truncation, so cost is bounded. */
  string: 2_048,
  depth: 6,
  /** Keys per object and items per array, Map or Set. */
  breadth: 50,
  /** Error cause chain depth. */
  causes: 3,
});

const TOKENS = Object.freeze({
  email: '[email]',
  upi: '[upi]',
  nationalId: '[aadhaar]', // privacycheck:ignore (the redaction token itself)
  phone: '[phone]',
  pan: '[pan]',
  gstin: '[gstin]',
  number: '[number]',
  redacted: '[redacted]',
  secret: '[secret]',
});

/**
 * Credentials and personal data, most specific first. Every pattern matches a given text
 * one way only (no ambiguous repetition), so matching stays linear; inputs are clipped to
 * LIMITS.string first.
 */
const PATTERNS: readonly (readonly [RegExp, string])[] = [
  // JSON Web Tokens and `Bearer`/`Basic` credentials pasted into free text.
  [/\beyJ[A-Za-z0-9_-]{4,2048}\.[A-Za-z0-9_-]{4,2048}\.[A-Za-z0-9_-]{0,2048}/g, TOKENS.secret],
  [/\b(Bearer|Basic) [A-Za-z0-9._~+/=-]{8,2048}/gi, `$1 ${TOKENS.secret}`],
  [
    /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}/g,
    TOKENS.email,
  ],
  // UPI ids look like name@bank, without a dot after the @.
  [/[A-Za-z0-9._-]{2,64}@[A-Za-z]{2,32}(?![A-Za-z0-9.])/g, TOKENS.upi],
  [/(?<![0-9A-Z])\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z](?![0-9A-Z])/g, TOKENS.gstin],
  [/(?<![0-9A-Z])[A-Z]{5}\d{4}[A-Z](?![0-9A-Z])/g, TOKENS.pan],
  // A +91 number first: written without a space it is also 12 digits starting 9.
  [/(?<!\d)\+91[ -]?[6-9]\d{4}[ -]?\d{5}(?![ -]?\d)/g, TOKENS.phone],
  // The national id (UIDAI): 12 digits, first 2 to 9, optionally 4-4-4. Removed whole (CMP-03).
  // The boundaries skip a separator too, so the first 12 digits of a card are not taken.
  [/(?<!\d[ -]?)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?![ -]?\d)/g, TOKENS.nationalId],
  // Indian mobile numbers: optional +91 or 0, then 10 digits starting 6 to 9.
  [/(?<!\d[ -]?)(?:\+91[ -]?|0)?[6-9]\d{4}[ -]?\d{5}(?![ -]?\d)/g, TOKENS.phone],
  // Bank accounts, card numbers and other long numbers: 9 or more digits, spaces or hyphens
  // allowed, taken whole so no trailing group is left behind. Not inside a word, so hex
  // digests and ids keep their shape.
  [/(?<![0-9A-Za-z])\d(?:[ -]?\d){8,}(?![0-9A-Za-z])/g, TOKENS.number],
];

/** Record ids are not personal data and must stay readable; they are kept as they are. */
const UUID =
  /(?<![0-9A-Za-z])([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?![0-9A-Za-z])/i;

/** Keys whose values are never logged, whatever they hold. */
const SECRET_KEY =
  /pass(?:word|wd|code)?|secret|token|authori[sz]ation|cookie|otp|^pin$|signature|api[_-]?key|private[_-]?key|credential|session[_-]?id|^body$|^raw[_-]?body$/i;

/**
 * A `name=value` pair after `?`, `&`, `#` or `;`: URL query strings and fragments (OAuth
 * puts tokens in fragments), absolute or relative. Values go; names stay for debugging.
 */
const QUERY_PAIR = /([?&#;][^\s=&#;?"'<>]{1,128})=[^\s&#;"'<>]{0,2048}/g;

/** The backstop for one string: truncate first, then replace every pattern. */
export function redactString(text: string): string {
  const clipped =
    text.length > LIMITS.string
      ? `${text.slice(0, LIMITS.string)}…[truncated ${String(text.length - LIMITS.string)} chars]`
      : text;
  // split with a capture group keeps the UUIDs at the odd indexes.
  return clipped
    .split(UUID)
    .map((part, index) => (index % 2 === 1 ? part : redactSegment(part)))
    .join('');
}

function redactSegment(text: string): string {
  let out = text.replace(QUERY_PAIR, `$1=${TOKENS.redacted}`);
  for (const [pattern, token] of PATTERNS) out = out.replace(pattern, token);
  return out;
}

export function isSecretKey(key: string): boolean {
  return SECRET_KEY.test(key);
}

const SAFE_TYPE_NAME = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
/** A SQLSTATE (`23505`), an app error code (`NOT_FOUND`) or a Node code (`ERR_X`). */
const SAFE_CODE = /^(?:[0-9A-Z]{5}|[A-Z][A-Z0-9_]{1,63})$/;

/**
 * An error, summarised: its type name and a stable code. Never the message or the stack: a
 * driver message can quote the offending row, phone numbers included.
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

/**
 * Turns any value into something safe to serialise. Strings go through the backstop;
 * secret-looking keys lose their values; `cause` keys are summarised as errors; Secret is
 * `[secret]`; getters, toJSON and toString are never called; cycles, depth and breadth are
 * capped. A hostile Proxy can still throw: the logger catches that and writes a fallback.
 */
export function redactValue(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  switch (typeof value) {
    case 'string':
      return redactString(value);
    case 'number':
      return Number.isFinite(value) ? value : String(value);
    case 'boolean':
      return value;
    case 'bigint':
      return redactString(value.toString());
    case 'undefined':
      return undefined;
    case 'symbol':
    case 'function':
      return '[unsupported]';
    case 'object':
      break;
  }
  if (value === null) return null;
  if (value instanceof Secret) return TOKENS.secret;
  if (value instanceof Error) return summariseError(value);
  if (value instanceof Date) {
    const time = Date.prototype.getTime.call(value);
    return Number.isNaN(time) ? '[invalid date]' : new Date(time).toISOString();
  }
  if (seen.has(value)) return '[circular]';
  if (depth >= LIMITS.depth) return '[depth limit]';
  seen.add(value);

  if (Array.isArray(value)) {
    const length = value.length;
    const items: unknown[] = [];
    for (let index = 0; index < Math.min(length, LIMITS.breadth); index += 1) {
      items.push(readOwn(value, String(index)));
    }
    return redactItems(items, length, depth, seen);
  }
  if (value instanceof Set) {
    return redactItems(take(value.values(), LIMITS.breadth), value.size, depth, seen);
  }
  if (value instanceof Map) {
    const entries = take(value.entries(), LIMITS.breadth).map(
      ([key, item]) => [mapKey(key), item] as const,
    );
    return redactObjectEntries(entries, value.size, depth, seen);
  }
  if (!isPlainObject(value)) {
    const name = constructorName(value);
    return `[${typeof name === 'string' && SAFE_TYPE_NAME.test(name) ? name : 'object'}]`;
  }
  const keys = Object.keys(value);
  const entries = keys.slice(0, LIMITS.breadth).map((key) => [key, readOwn(value, key)] as const);
  return redactObjectEntries(entries, keys.length, depth, seen);
}

function redactItems(
  items: readonly unknown[],
  total: number,
  depth: number,
  seen: WeakSet<object>,
): unknown[] {
  const out = items
    .slice(0, LIMITS.breadth)
    .map((item) => (item === GETTER ? '[getter]' : (redactValue(item, depth + 1, seen) ?? null)));
  if (total > LIMITS.breadth) out.push(`[${String(total - LIMITS.breadth)} more items]`);
  return out;
}

function redactObjectEntries(
  entries: readonly (readonly [string, unknown])[],
  total: number,
  depth: number,
  seen: WeakSet<object>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of entries.slice(0, LIMITS.breadth)) {
    const safeKey = redactString(key);
    if (field === GETTER) setOwn(out, safeKey, '[getter]');
    else if (isSecretKey(key)) setOwn(out, safeKey, TOKENS.redacted);
    else if (key === 'cause') setOwn(out, safeKey, summariseError(field));
    else {
      const redacted = redactValue(field, depth + 1, seen);
      if (redacted !== undefined) setOwn(out, safeKey, redacted);
    }
  }
  if (total > LIMITS.breadth) setOwn(out, '[omitted]', total - LIMITS.breadth);
  return out;
}
