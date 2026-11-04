/**
 * The only source of time. Code never calls `Date.now()`, `new Date()` or
 * `performance.now()` directly, so tests can freeze and advance time (the frozen clock is
 * in @gx/testkit).
 */
export interface Clock {
  /** Wall time in milliseconds since the Unix epoch. Can jump when the system clock is set. */
  nowMillis(): number;
  /**
   * Milliseconds from an arbitrary origin that never goes backwards. Use it for durations,
   * timeouts and latency, never as a timestamp.
   */
  monotonicMillis(): number;
}

interface PerformanceLike {
  now(): number;
}

const performanceClock = (globalThis as { performance?: PerformanceLike }).performance;

export const systemClock: Clock = Object.freeze({
  nowMillis: (): number => Date.now(),
  monotonicMillis: (): number => {
    if (performanceClock === undefined) {
      throw new Error('No monotonic clock (globalThis.performance) is available');
    }
    return performanceClock.now();
  },
});

/** The clock's wall time as a new `Date`. */
export function nowDate(clock: Clock): Date {
  return new Date(clock.nowMillis());
}
