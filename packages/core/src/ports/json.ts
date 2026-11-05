import { coreError, type AppError } from '../errors.ts';
import { err, ok, type Result } from '../result.ts';

export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** Deep enough for any event or audit payload; deeper nesting is a bug or an attack. */
const MAX_JSON_DEPTH = 64;
/**
 * Values visited, counting a shared sub-object once per reference: without a cap, a small
 * object graph that reuses nodes expands exponentially and hangs the copy.
 */
const MAX_JSON_NODES = 100_000;

/**
 * A deep, frozen copy of a JSON value, so a payload cannot change after it is handed over.
 * Rejects what JSON would silently change or drop: undefined, functions, NaN, Infinity,
 * bigints, symbols, sparse arrays, class instances (Date, Map), cycles, deep nesting,
 * oversized graphs, and getters or proxies that throw while being read.
 */
export function toFrozenJson(value: unknown): Result<JsonValue, AppError<'VALIDATION_FAILED'>> {
  const failure: CopyState = { path: '', code: '', nodes: 0 };
  let copy: JsonValue | typeof INVALID;
  try {
    copy = copyJson(value, [], new Set(), failure);
  } catch {
    // A getter or proxy trap threw; the value cannot be read safely, so it is not JSON.
    failure.code = 'unreadable';
    copy = INVALID;
  }
  return copy === INVALID
    ? err(
        coreError('VALIDATION_FAILED', {
          fields: [{ path: failure.path, code: failure.code }],
          detail: 'value is not plain JSON',
        }),
      )
    : ok(copy);
}

const INVALID = Symbol('invalid');

interface CopyState {
  path: string;
  code: string;
  nodes: number;
}

function copyJson(
  value: unknown,
  path: readonly string[],
  ancestors: Set<object>,
  failure: CopyState,
): JsonValue | typeof INVALID {
  const fail = (code: string, at: readonly string[] = path): typeof INVALID => {
    failure.path = at.join('.');
    failure.code = code;
    return INVALID;
  };
  failure.nodes += 1;
  if (failure.nodes > MAX_JSON_NODES) return fail('too_large');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fail('not_finite');
  if (typeof value !== 'object') return fail('not_json');
  if (path.length >= MAX_JSON_DEPTH) return fail('too_deep');
  if (ancestors.has(value)) return fail('cycle');

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const items: JsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const itemPath = [...path, String(index)];
        if (!(index in value)) return fail('sparse_array', itemPath);
        const item = copyJson(value[index], itemPath, ancestors, failure);
        if (item === INVALID) return INVALID;
        items.push(item);
      }
      return Object.freeze(items);
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return fail('not_plain_object');
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      const copy = copyJson(item, [...path, key], ancestors, failure);
      if (copy === INVALID) return INVALID;
      // defineProperty keeps a "__proto__" key as data instead of changing the prototype.
      Object.defineProperty(result, key, {
        value: copy,
        enumerable: true,
        writable: false,
        configurable: false,
      });
    }
    return Object.freeze(result);
  } finally {
    ancestors.delete(value);
  }
}
