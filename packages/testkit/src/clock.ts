import type { Clock } from '@gx/core';
import { FIXTURE_MILLIS } from './contract.ts';

/**
 * A clock that only moves when a test says so. Code under test reads time through the core
 * `Clock` port, so `advance` makes it see exactly that much time pass, with no sleeping.
 *
 * Wall time and monotonic time are separate on purpose: `advance` moves both, `setWallTime`
 * moves only wall time (an operator or NTP stepping the system clock), so a test can prove
 * that durations and timeouts never depend on the wall clock.
 */
export class FrozenClock implements Clock {
  #wallMillis: number;
  #monotonicMillis: number;

  /** Defaults to 2026-01-01T00:00:00Z, the instant the contract suites use. */
  constructor(startMillis: number = FIXTURE_MILLIS, monotonicStartMillis = 0) {
    this.#wallMillis = requireFinite(startMillis, 'startMillis');
    this.#monotonicMillis = requireNonNegative(monotonicStartMillis, 'monotonicStartMillis');
  }

  nowMillis(): number {
    return this.#wallMillis;
  }

  monotonicMillis(): number {
    return this.#monotonicMillis;
  }

  /** Moves wall and monotonic time forward together. Time never goes backwards here. */
  advance(millis: number): void {
    const step = requireNonNegative(millis, 'millis');
    this.#wallMillis += step;
    this.#monotonicMillis += step;
  }

  /** Jumps wall time to any instant, even an earlier one. Monotonic time does not change. */
  setWallTime(millis: number): void {
    this.#wallMillis = requireFinite(millis, 'millis');
  }
}

function requireFinite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number`);
  return value;
}

function requireNonNegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite number of milliseconds, zero or more`);
  }
  return value;
}
