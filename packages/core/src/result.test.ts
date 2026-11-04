import { describe, expect, it } from 'vitest';
import { nowDate, systemClock } from './clock.ts';
import { err, ok, type Result } from './result.ts';

describe('Result', () => {
  it('narrows on ok', () => {
    const parse = (value: string): Result<number, string> =>
      /^\d+$/.test(value) ? ok(Number(value)) : err('NOT_A_NUMBER');
    const good = parse('42');
    const bad = parse('x');
    expect(good.ok && good.value).toBe(42);
    expect(!bad.ok && bad.error).toBe('NOT_A_NUMBER');
  });
});

describe('systemClock', () => {
  it('reads real time in epoch milliseconds', () => {
    const before = Date.now();
    const reading = systemClock.nowMillis();
    expect(reading).toBeGreaterThanOrEqual(before);
    expect(Number.isSafeInteger(reading)).toBe(true);
  });

  it('reads a monotonic time that never goes backwards', () => {
    const readings = Array.from({ length: 1_000 }, () => systemClock.monotonicMillis());
    for (let i = 1; i < readings.length; i += 1) {
      expect(readings[i]).toBeGreaterThanOrEqual(readings[i - 1] ?? 0);
    }
  });

  it('nowDate returns a fresh Date for the clock reading', () => {
    const clock = { nowMillis: () => 86_400_000, monotonicMillis: () => 0 };
    expect(nowDate(clock).toISOString()).toBe('1970-01-02T00:00:00.000Z');
    expect(nowDate(clock)).not.toBe(nowDate(clock));
  });
});
