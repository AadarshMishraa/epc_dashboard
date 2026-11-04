/**
 * The only source of time. Code never calls `Date.now()` or `new Date()` directly, so
 * tests can freeze and advance time (the frozen clock is in @gx/testkit).
 */
export interface Clock {
  /** Current time in milliseconds since the Unix epoch. */
  nowMillis(): number;
}

export const systemClock: Clock = Object.freeze({
  nowMillis: (): number => Date.now(),
});

/** The clock's current time as a new `Date`. */
export function nowDate(clock: Clock): Date {
  return new Date(clock.nowMillis());
}
