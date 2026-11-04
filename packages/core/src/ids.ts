import type { Clock } from './clock.ts';

declare const idBrand: unique symbol;

/** A canonical lowercase UUID; the stored form of every record id (Postgres `uuid`). */
export type Id = string & { readonly [idBrand]: true };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isId(value: unknown): value is Id {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Accepts any letter case from untrusted input and returns the canonical form, or undefined. */
export function parseId(value: unknown): Id | undefined {
  if (typeof value !== 'string') return undefined;
  const lower = value.toLowerCase();
  return isId(lower) ? lower : undefined;
}

/** Fills the array with cryptographically strong random bytes. */
export type RandomBytes = (target: Uint8Array) => void;

/** Web Crypto, present in Node.js, browsers and edge runtimes; fails closed when missing. */
export const webCryptoRandomBytes: RandomBytes = (target) => {
  const webCrypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  if (typeof webCrypto?.getRandomValues !== 'function') {
    throw new Error('No cryptographically strong random source (globalThis.crypto) is available');
  }
  webCrypto.getRandomValues(target);
};

export interface IdGeneratorOptions {
  readonly clock: Clock;
  readonly randomBytes?: RandomBytes;
}

export type IdGenerator = () => Id;

const MAX_COUNTER = 0xfff; // 12-bit rand_a field
const COUNTER_SEED_MASK = 0x7ff; // seed in the lower half, leaving at least 2048 steps per millisecond
const MAX_TIMESTAMP = 2 ** 48 - 1;

/**
 * UUIDv7 ids (RFC 9562): 48-bit Unix milliseconds, then a 12-bit counter (method 1), then
 * 62 random bits. Ids from one generator sort strictly in creation order as strings, even
 * within one millisecond, and even if the clock steps backwards (the generator holds its
 * last timestamp until the clock catches up).
 */
export function createIdGenerator(options: IdGeneratorOptions): IdGenerator {
  const randomBytes = options.randomBytes ?? webCryptoRandomBytes;
  let lastMillis = -1;
  let counter = 0;
  const bytes = new Uint8Array(16);
  const seed = new Uint8Array(2);

  const seedCounter = (): number => {
    randomBytes(seed);
    return (((seed[0] ?? 0) << 8) | (seed[1] ?? 0)) & COUNTER_SEED_MASK;
  };

  return () => {
    const now = options.clock.nowMillis();
    if (!Number.isSafeInteger(now) || now < 0 || now > MAX_TIMESTAMP) {
      throw new RangeError(`Clock returned an unusable time: ${String(now)}`);
    }
    if (now > lastMillis) {
      lastMillis = now;
      counter = seedCounter();
    } else if (counter < MAX_COUNTER) {
      counter += 1;
    } else {
      // Counter exhausted in this millisecond: borrow the next one.
      lastMillis += 1;
      counter = seedCounter();
    }

    randomBytes(bytes);
    let millis = lastMillis;
    for (let i = 5; i >= 0; i -= 1) {
      bytes[i] = millis % 256;
      millis = Math.floor(millis / 256);
    }
    bytes[6] = 0x70 | (counter >> 8);
    bytes[7] = counter & 0xff;
    bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);
    return format(bytes);
  };
}

/** Milliseconds since the epoch encoded in a UUIDv7, or undefined for other versions. */
export function idTimestamp(id: Id): number | undefined {
  if (id[14] !== '7') return undefined;
  return Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
}

function format(bytes: Uint8Array): Id {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as Id;
}
