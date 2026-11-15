import { isErrorCode, isErrorStatus } from '../errors.ts';
import { isUnchangedByScrub, scrubText } from './scrub.ts';

/**
 * What a log line may say about an error. A catalogue error (`AppError`) gives its code,
 * status, field problems and scrubbed `detail`. Anything else, including every `cause`, gives
 * only its type name, a short code and stack frames: a driver message can hold personal data
 * ("Key (email)=(...) already exists"), so `message` and `detail` of a foreign error are
 * never read. Keys are snake_case because the summary is written into the line as it is.
 */
export interface ErrorSummary {
  /** `AppError`, a constructor name, a primitive type name, or `Unknown`. */
  readonly type: string;
  readonly code?: string | number;
  readonly status?: number;
  readonly retryable?: boolean;
  readonly detail?: string;
  readonly fields?: readonly { readonly path: string; readonly code: string }[];
  readonly retry_after_seconds?: number;
  /** Stack frames of the first foreign error in the chain, without its message. */
  readonly frames?: readonly string[];
  readonly cause?: ErrorSummary;
}

/** Causes summarised below the error itself; a longer or circular chain stops here. */
const MAX_CAUSE_DEPTH = 3;
const MAX_FIELD_ERRORS = 20;
const MAX_FIELD_PATH_LENGTH = 64;
const MAX_FRAMES = 10;
const MAX_FRAME_LENGTH = 160;
/** A longer stack is not split and scanned. */
const MAX_STACK_LENGTH = 16_384;
/** A number with 8 or more digits could be a phone number; this bounds codes and retry delays. */
const MAX_NUMERIC_CODE = 9_999_999;
const TYPE_NAME_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
const SHORT_CODE_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
/**
 * A V8 frame: `at name (location:line:column)`, `at name (<anonymous>)`, or a bare location
 * that starts like a path. A line of a multi-line message that merely begins with "at" is not.
 */
const FRAME_PATTERN =
  /^\s*at (?:async |new )*[^\s()]+(?: \[as [^\s()]+\])? \((?:.*:\d+:\d+|<anonymous>|native)\)$|^\s*at (?:async )?(?:file:|node:|\/|[A-Za-z]:[\\/]).*:\d+:\d+$/u;
const INVALID = '[invalid]';
const UNKNOWN_TYPE = 'Unknown';

/** A property read that cannot throw: a getter, a Proxy trap or a revoked Proxy gives `undefined`. */
function readProperty(target: object, key: string): unknown {
  try {
    return (target as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

function safeCode(value: unknown): string | number | undefined {
  if (typeof value === 'string') {
    return SHORT_CODE_PATTERN.test(value) && isUnchangedByScrub(value) ? value : undefined;
  }
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    Math.abs(value) <= MAX_NUMERIC_CODE
    ? value
    : undefined;
}

function typeName(value: object): string {
  const constructor = readProperty(value, 'constructor');
  if (typeof constructor !== 'function') return UNKNOWN_TYPE;
  const name = readProperty(constructor, 'name');
  return typeof name === 'string' && TYPE_NAME_PATTERN.test(name) && isUnchangedByScrub(name)
    ? name
    : UNKNOWN_TYPE;
}

function stackFrames(value: object): string[] {
  const stack = readProperty(value, 'stack');
  if (typeof stack !== 'string' || stack.length > MAX_STACK_LENGTH) return [];
  return stack
    .split('\n')
    .filter((line) => FRAME_PATTERN.test(line))
    .slice(0, MAX_FRAMES)
    .map((line) => scrubText(line.trim()).slice(0, MAX_FRAME_LENGTH));
}

function fieldProblems(value: unknown): { path: string; code: string }[] {
  if (!Array.isArray(value)) return [];
  const problems: { path: string; code: string }[] = [];
  for (const entry of value.slice(0, MAX_FIELD_ERRORS) as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    const path = readProperty(entry, 'path');
    const code = safeCode(readProperty(entry, 'code'));
    problems.push({
      path: typeof path === 'string' ? scrubText(path).slice(0, MAX_FIELD_PATH_LENGTH) : INVALID,
      code: typeof code === 'string' ? code : INVALID,
    });
  }
  return problems;
}

/**
 * The parts of a catalogue error, or `undefined` for anything else. All five must be right:
 * a database error also has a `code` and a `detail`, and its `detail` must never be read.
 */
function appErrorParts(value: object): ErrorSummary | undefined {
  const code = readProperty(value, 'code');
  const status = readProperty(value, 'status');
  const retryable = readProperty(value, 'retryable');
  const fields = readProperty(value, 'fields');
  if (
    !isErrorCode(code) ||
    !isUnchangedByScrub(code) ||
    !isErrorStatus(status) ||
    typeof retryable !== 'boolean' ||
    !Array.isArray(fields) ||
    typeof readProperty(value, 'message') !== 'string'
  ) {
    return undefined;
  }
  const detail = readProperty(value, 'detail');
  const retryAfter = readProperty(value, 'retryAfterSeconds');
  const problems = fieldProblems(fields);
  return {
    type: 'AppError',
    code,
    status,
    retryable,
    ...(typeof detail === 'string' ? { detail: scrubText(detail) } : {}),
    ...(problems.length === 0 ? {} : { fields: problems }),
    ...(typeof retryAfter === 'number' &&
    Number.isSafeInteger(retryAfter) &&
    retryAfter >= 0 &&
    retryAfter <= MAX_NUMERIC_CODE
      ? { retry_after_seconds: retryAfter }
      : {}),
  };
}

interface ChainState {
  /** Frames are taken once, from the first foreign error, so a long chain stays small. */
  framesTaken: boolean;
}

function summarise(value: unknown, depth: number, state: ChainState): ErrorSummary {
  if (typeof value !== 'object' || value === null) {
    return { type: value === null ? 'null' : typeof value };
  }
  let summary = appErrorParts(value);
  if (summary === undefined) {
    const code = safeCode(readProperty(value, 'code'));
    const frames = state.framesTaken ? [] : stackFrames(value);
    state.framesTaken = true;
    summary = {
      type: typeName(value),
      ...(code === undefined ? {} : { code }),
      ...(frames.length === 0 ? {} : { frames }),
    };
  }
  const cause = readProperty(value, 'cause');
  return cause === undefined || depth >= MAX_CAUSE_DEPTH
    ? summary
    : { ...summary, cause: summarise(cause, depth + 1, state) };
}

/** Types, codes and status only, for a line that has no room for detail, fields or frames. */
export function compactErrorSummary(summary: ErrorSummary): ErrorSummary {
  return {
    type: summary.type,
    ...(summary.code === undefined ? {} : { code: summary.code }),
    ...(summary.status === undefined ? {} : { status: summary.status }),
    ...(summary.retryable === undefined ? {} : { retryable: summary.retryable }),
    ...(summary.cause === undefined ? {} : { cause: compactErrorSummary(summary.cause) }),
  };
}

/**
 * A summary of any thrown or returned error that is safe to log and to send to an error
 * tracker. It never throws: a value it cannot read is `{ type: 'Unknown' }`.
 */
export function summariseError(error: unknown): ErrorSummary {
  try {
    return summarise(error, 0, { framesTaken: false });
  } catch {
    // A Proxy trap outside a property read (for example `isArray` on a revoked Proxy).
    return { type: UNKNOWN_TYPE };
  }
}
