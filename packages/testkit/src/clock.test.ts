import { nowDate, systemClock, type Clock } from '@gx/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FIXTURE_MILLIS } from './contract.ts';
import { FrozenClock } from './index.ts';

const HOUR_MILLIS = 60 * 60 * 1000;

// Code under test only sees the port, the way production code does.
function elapsedMillis(clock: Clock, work: () => void): number {
  const start = clock.nowMillis();
  work();
  return clock.nowMillis() - start;
}

describe('FrozenClock', () => {
  it('starts at the fixture instant and does not move on its own', () => {
    const clock = new FrozenClock();
    expect(clock.nowMillis()).toBe(FIXTURE_MILLIS);
    expect(clock.monotonicMillis()).toBe(0);
    expect(nowDate(clock).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(clock.nowMillis()).toBe(FIXTURE_MILLIS);
  });

  it('makes time-based code see exactly 24 hours elapse (F-03-AC4)', () => {
    const clock = new FrozenClock();
    const elapsed = elapsedMillis(clock, () => {
      clock.advance(24 * HOUR_MILLIS);
    });
    expect(elapsed).toBe(86_400_000);
    expect(nowDate(clock).toISOString()).toBe('2026-01-02T00:00:00.000Z');
    expect(clock.monotonicMillis()).toBe(86_400_000);
  });

  it('adds up any sequence of advances exactly', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 10 * HOUR_MILLIS }), { maxLength: 50 }),
        (steps) => {
          const clock = new FrozenClock(0, 0);
          for (const step of steps) clock.advance(step);
          const total = steps.reduce((sum, step) => sum + step, 0);
          expect(clock.nowMillis()).toBe(total);
          expect(clock.monotonicMillis()).toBe(total);
        },
      ),
    );
  });

  it('keeps monotonic time still when wall time is set, even backwards', () => {
    const clock = new FrozenClock();
    clock.advance(1_000);
    clock.setWallTime(FIXTURE_MILLIS - HOUR_MILLIS);
    expect(clock.nowMillis()).toBe(FIXTURE_MILLIS - HOUR_MILLIS);
    expect(clock.monotonicMillis()).toBe(1_000);
  });

  it('refuses a step that is negative, infinite or not a number', () => {
    const clock = new FrozenClock();
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => {
        clock.advance(bad);
      }).toThrow(RangeError);
    }
    expect(() => new FrozenClock(Number.NaN)).toThrow(RangeError);
    expect(() => new FrozenClock(0, -1)).toThrow(RangeError);
    expect(() => {
      clock.setWallTime(Number.NaN);
    }).toThrow(RangeError);
    expect(clock.nowMillis()).toBe(FIXTURE_MILLIS);
  });

  it('gives two clocks separate time', () => {
    const a = new FrozenClock();
    const b = new FrozenClock();
    a.advance(5);
    expect(b.nowMillis()).toBe(FIXTURE_MILLIS);
  });

  it('can stand in wherever the system clock is expected', () => {
    const use = (clock: Clock): number => clock.nowMillis();
    expect(use(new FrozenClock(42))).toBe(42);
    expect(use(systemClock)).toBeGreaterThan(FIXTURE_MILLIS);
  });
});
