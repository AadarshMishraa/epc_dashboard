import type { Clock } from '@gx/core';

export interface FrozenClock extends Clock {
  /** Moves both wall and monotonic time forward. */
  advance(ms: number): void;
  /** Sets wall time (it may jump backwards, as a real clock can); monotonic time is unchanged. */
  setWall(epochMillis: number): void;
}

/** A clock that moves only when told to (F-03-AC4: advancing 24 hours shows exactly 24 hours). */
export function frozenClock(startEpochMillis = Date.UTC(2026, 0, 1)): FrozenClock {
  let wall = startEpochMillis;
  let monotonic = 0;
  return {
    nowMillis: () => wall,
    monotonicMillis: () => monotonic,
    advance(ms) {
      if (!Number.isFinite(ms) || ms < 0)
        throw new RangeError('advance takes a non-negative number of milliseconds');
      wall += ms;
      monotonic += ms;
    },
    setWall(epochMillis) {
      wall = epochMillis;
    },
  };
}
