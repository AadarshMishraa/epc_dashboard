import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Clock } from './clock.ts';
import { createIdGenerator, idTimestamp, isId, parseId, type RandomBytes } from './ids.ts';

/** A clock that returns the given readings in order, then repeats the last one. */
function scriptedClock(readings: readonly number[]): Clock {
  let index = 0;
  return {
    nowMillis: () => {
      const value = readings[Math.min(index, readings.length - 1)] ?? 0;
      index += 1;
      return value;
    },
  };
}

/** Deterministic bytes from a seed, so property failures replay exactly. */
function seededRandom(seed: number): RandomBytes {
  let state = seed >>> 0 || 1;
  return (target) => {
    for (let i = 0; i < target.length; i += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      target[i] = state & 0xff;
    }
  };
}

const TIME = fc.integer({ min: 0, max: 2 ** 48 - 2 ** 20 });

describe('createIdGenerator (UUIDv7)', () => {
  it('produces canonical version-7, variant-10 UUIDs', () => {
    const next = createIdGenerator({ clock: scriptedClock([1_700_000_000_000]) });
    const id = next();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(isId(id)).toBe(true);
  });

  it('encodes the clock time in the first 48 bits', () => {
    const next = createIdGenerator({ clock: scriptedClock([1_762_243_200_123]) });
    expect(idTimestamp(next())).toBe(1_762_243_200_123);
  });

  it('property: ids sort strictly in creation order for any clock readings, including repeats and steps back', () => {
    fc.assert(
      fc.property(
        fc.array(TIME, { minLength: 2, maxLength: 200 }),
        fc.integer(),
        (readings, seed) => {
          const next = createIdGenerator({
            clock: scriptedClock(readings),
            randomBytes: seededRandom(seed),
          });
          const ids = readings.map(() => next());
          for (let i = 1; i < ids.length; i += 1) {
            expect((ids[i - 1] ?? '') < (ids[i] ?? '')).toBe(true);
          }
        },
      ),
      { seed: 20261104, numRuns: 300 },
    );
  });

  it('property: the encoded time never runs behind the clock and never goes backwards', () => {
    fc.assert(
      fc.property(
        fc.array(TIME, { minLength: 1, maxLength: 100 }),
        fc.integer(),
        (readings, seed) => {
          const next = createIdGenerator({
            clock: scriptedClock(readings),
            randomBytes: seededRandom(seed),
          });
          let previous = -1;
          let maxSeen = -1;
          for (const reading of readings) {
            maxSeen = Math.max(maxSeen, reading);
            const stamp = idTimestamp(next()) ?? -1;
            expect(stamp).toBeGreaterThanOrEqual(maxSeen);
            expect(stamp).toBeGreaterThanOrEqual(previous);
            previous = stamp;
          }
        },
      ),
      { seed: 20261105, numRuns: 300 },
    );
  });

  it('stays ordered and unique past the 4096-per-millisecond counter (frozen clock)', () => {
    const next = createIdGenerator({ clock: scriptedClock([1_000]) });
    const ids = Array.from({ length: 10_000 }, () => next());
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    // The generator borrows future milliseconds, but only as far as it must.
    expect(idTimestamp(ids.at(-1) ?? ids[0] ?? next()) ?? 0).toBeLessThan(1_000 + 10);
  });

  it('gives two generators distinct ids at the same instant', () => {
    const clock = scriptedClock([5_000]);
    const a = createIdGenerator({ clock });
    const b = createIdGenerator({ clock });
    const ids = new Set(Array.from({ length: 1_000 }, (_, i) => (i % 2 === 0 ? a() : b())));
    expect(ids.size).toBe(1_000);
  });

  it.each([Number.NaN, -1, 1.5, 2 ** 48, Number.POSITIVE_INFINITY])(
    'refuses an unusable clock reading %s',
    (reading) => {
      const next = createIdGenerator({ clock: scriptedClock([reading]) });
      expect(() => next()).toThrow(RangeError);
    },
  );

  it('fails closed when no strong random source exists', () => {
    const next = createIdGenerator({
      clock: scriptedClock([1]),
      randomBytes: () => {
        throw new Error('no entropy');
      },
    });
    expect(() => next()).toThrow('no entropy');
  });
});

describe('parseId and isId', () => {
  it('canonicalises letter case from untrusted input', () => {
    expect(parseId('0190F3E2-7A1B-7C3D-8E4F-0123456789AB')).toBe(
      '0190f3e2-7a1b-7c3d-8e4f-0123456789ab',
    );
  });

  it('accepts other UUID versions, for example v4 from the database', () => {
    expect(isId('3d6f0a8e-1b2c-4d5e-9f60-718293a4b5c6')).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['no hyphens', '0190f3e27a1b7c3d8e4f0123456789ab'],
    ['wrong variant', '0190f3e2-7a1b-7c3d-0e4f-0123456789ab'],
    ['version 0', '0190f3e2-7a1b-0c3d-8e4f-0123456789ab'],
    ['trailing text', '0190f3e2-7a1b-7c3d-8e4f-0123456789ab; drop table'],
    ['uppercase is not canonical', '0190F3E2-7A1B-7C3D-8E4F-0123456789AB'],
  ])('isId rejects %s', (_label, value) => {
    expect(isId(value)).toBe(false);
  });

  it('parseId rejects non-strings', () => {
    expect(parseId(42)).toBeUndefined();
    expect(parseId(null)).toBeUndefined();
  });

  it('idTimestamp is undefined for non-v7 ids', () => {
    expect(
      idTimestamp(parseId('3d6f0a8e-1b2c-4d5e-9f60-718293a4b5c6') ?? ('' as never)),
    ).toBeUndefined();
  });
});
