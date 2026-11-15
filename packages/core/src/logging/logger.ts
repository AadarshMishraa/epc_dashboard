import { parseAiClientId, parseCorrelationId, type Context } from '../context.ts';
import { isId } from '../ids.ts';
import { isModuleId, type ModuleId } from '../module-id.ts';
import {
  classifyField,
  type ClassificationLookup,
  type FieldRef,
} from '../ports/classification.ts';
import { Secret } from '../ports/secret.ts';
import { compactErrorSummary, summariseError } from './error-summary.ts';
import { isUnchangedByScrub, scrubText } from './scrub.ts';

/**
 * Structured logging with redaction (threat model docs/security/threat-models/K0-T04-logging.md).
 * One JSON object per line. The tenant, actor and correlation id come from the context, never
 * from the caller's fields. Redaction runs before the sink sees anything, at every level, and
 * there is no option that turns it off. Core does no I/O: the host supplies the sink.
 */

export const LOG_LEVELS = Object.freeze(['debug', 'info', 'warn', 'error'] as const);
export type LogLevel = (typeof LOG_LEVELS)[number];

/** A line is never longer than this in UTF-8, so a log shipper does not split it. */
export const LOG_MAX_LINE_BYTES = 8_192;
/** Fields written per line; the rest are dropped and counted. */
export const LOG_MAX_FIELDS = 64;

export type LogScalar = string | number | boolean | null;

const CLASSIFIED_TEXT = '[classified]';

/**
 * A value tied to the field it came from, so the logger can mask it by that field's
 * classification. Made with `classified`. It prints `[classified]` everywhere else.
 */
export class ClassifiedValue {
  readonly #field: FieldRef;
  readonly #value: unknown;

  constructor(field: FieldRef, value: unknown) {
    this.#field = field;
    this.#value = value;
    Object.freeze(this);
  }

  /** The parts of a wrapper made by this copy of the package; anything else is `undefined`. */
  static unwrap(candidate: unknown): { field: FieldRef; value: unknown } | undefined {
    if (typeof candidate !== 'object' || candidate === null || !(#field in candidate)) {
      return undefined;
    }
    return { field: candidate.#field, value: candidate.#value };
  }

  toString(): string {
    return CLASSIFIED_TEXT;
  }

  toJSON(): string {
    return CLASSIFIED_TEXT;
  }
}

/**
 * Marks a value as belonging to `field`. The logger asks the classification lookup: a public
 * or internal value is written (still scrubbed), and a personal, sensitive or secret one is
 * replaced by its class name. A field the lookup does not know is `secret`.
 */
export function classified(field: FieldRef, value: LogScalar): ClassifiedValue {
  return new ClassifiedValue(field, value);
}

export type LogFieldValue = LogScalar | ClassifiedValue | Secret;

/** Flat, with lower_snake_case keys. Objects and arrays are not written. */
export type LogFields = Readonly<Record<string, LogFieldValue>>;

export interface LogData {
  readonly fields?: LogFields;
  /** Any thrown or returned error; written as `summariseError` gives it. */
  readonly error?: unknown;
}

/**
 * Receives one finished, redacted JSON line without a line break. It may return a promise
 * (a network sink): a rejection is reported like a throw, and the log call does not wait.
 */
export type LogSink = (line: string) => unknown;

export interface LoggerOptions {
  readonly sink: LogSink;
  readonly classification: ClassificationLookup;
  /** The package that writes through this logger. */
  readonly module?: ModuleId;
  /** Lines below this level are skipped. Defaults to `info`. */
  readonly minLevel?: LogLevel;
  /** Told when the sink throws or rejects. A log call itself never throws. */
  readonly onSinkError?: (cause: unknown) => void;
}

export interface Logger {
  debug(context: Context, event: string, data?: LogData): void;
  info(context: Context, event: string, data?: LogData): void;
  warn(context: Context, event: string, data?: LogData): void;
  error(context: Context, event: string, data?: LogData): void;
}

const INVALID = '[invalid]';
const UNREADABLE_VALUE = '[omitted:unreadable]';
const INVALID_EVENT = 'log.invalid_event';
const EVENT_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;
const MAX_EVENT_LENGTH = 128;
const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const PROCESS_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;
const QUERY_START = /[?#]/;
const MAX_AI_SCOPES = 8;
/** The largest time value a `Date` can hold. */
const MAX_DATE_MILLIS = 8.64e15;
/** Written when even the fallback line cannot be built. */
const LAST_RESORT_LINE =
  '{"ts":null,"level":"error","event":"log.redaction_failed","redaction_failed":true}';
/**
 * Characters `JSON.stringify` leaves raw that can break a line or mislead a log viewer:
 * DEL and C1 controls, the Unicode line and paragraph separators, and bidi controls.
 */
const UNSAFE_LINE_CHARACTERS = /[\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;

/**
 * Key names that are masked whatever the value's shape. This is a second layer: it is the
 * only control for a credential with no shape (a password, a one-time code) and for a phone
 * passed as a number. A key it does not name is not covered.
 *
 * A long, unambiguous word is matched anywhere in the key (`accesstoken`, `phonenumber`). A
 * short one would mask ordinary keys (`zip`, `company`, `spin`), so it must stand between
 * underscores.
 */
const keyNames = (anywhere: readonly string[], betweenUnderscores: readonly string[]): RegExp =>
  new RegExp(`${anywhere.join('|')}|(?:^|_)(?:${betweenUnderscores.join('|')})s?(?:_|$)`);
const SECRET_KEYS = keyNames(
  [
    'password',
    'passwd',
    'passcode',
    'secret',
    'token',
    'otp',
    'jwt',
    'bearer',
    'session',
    'signature',
    'authorization',
    'cookie',
    'credential',
    'api_?key',
    'private_?key',
    'signing_?key',
    'access_?key',
    'encryption_?key',
  ],
  ['pwd', 'pin', 'salt'],
);
const SENSITIVE_KEYS = keyNames(
  [
    'aadhaar', // privacycheck:ignore (a deny-list entry, not a stored field)
    'aadhar', // privacycheck:ignore (the common misspelling of the entry above)
    'account_?number',
    'card_?number', // privacycheck:ignore (a deny-list entry, not a stored field)
  ],
  ['pan'],
);
const PERSONAL_KEYS = keyNames(
  ['phone', 'mobile', 'email', 'address', 'first_?name', 'last_?name', 'full_?name'],
  ['dob', 'ip', 'upi', 'vpa'],
);

function deniedKeyToken(key: string): string | undefined {
  if (SECRET_KEYS.test(key)) return '[secret]';
  if (SENSITIVE_KEYS.test(key)) return '[sensitive_personal]';
  if (PERSONAL_KEYS.test(key)) return '[personal]';
  return undefined;
}

/** What went wrong while building a line; written on the line so it is not lost. */
interface Problems {
  classification_errors: number;
  dropped_fields: number;
  invalid_context: number;
  invalid_event: boolean;
  clock_failed: boolean;
  error_compacted: boolean;
}

type Line = Record<string, unknown>;

const emptyObject = (): Line => Object.create(null) as Line;

const UNREADABLE = Symbol('unreadable');

/** Runs a read that may hit a throwing getter or Proxy trap. */
function attempt<T>(read: () => T): T | typeof UNREADABLE {
  try {
    return read();
  } catch {
    return UNREADABLE;
  }
}

function property(target: unknown, key: string): unknown {
  return attempt(() => (target as Record<string, unknown>)[key]);
}

function invalid(problems: Problems): string {
  problems.invalid_context += 1;
  return INVALID;
}

function idOrInvalid(value: unknown, problems: Problems): string {
  return isId(value) ? value : invalid(problems);
}

function timestamp(context: Context, problems: Problems): string | null {
  const millis = attempt(() => context.clock.nowMillis());
  if (
    typeof millis === 'number' &&
    Number.isFinite(millis) &&
    Math.abs(millis) <= MAX_DATE_MILLIS
  ) {
    return new Date(millis).toISOString();
  }
  problems.clock_failed = true;
  return null;
}

function eventName(event: unknown, problems: Problems): string {
  if (
    typeof event === 'string' &&
    event.length <= MAX_EVENT_LENGTH &&
    EVENT_PATTERN.test(event) &&
    isUnchangedByScrub(event)
  ) {
    return event;
  }
  problems.invalid_event = true;
  return INVALID_EVENT;
}

/** A client-chosen id may be a URL: its query string and fragment are dropped, the rest scrubbed. */
function aiClient(via: unknown, problems: Problems): Line | string {
  const clientId = parseAiClientId(property(via, 'clientId'));
  if (clientId === undefined) return invalid(problems);
  const queryStart = clientId.search(QUERY_START);
  const scopes = attempt((): unknown[] => {
    const granted = (via as { scopes?: unknown }).scopes;
    return Array.isArray(granted)
      ? (granted.slice(0, MAX_AI_SCOPES) as unknown[]).filter(
          (scope) => scope === 'read' || scope === 'write',
        )
      : [];
  });
  const result = emptyObject();
  result['client_id'] = scrubText(
    queryStart === -1 ? clientId : `${clientId.slice(0, queryStart)}[query]`,
  );
  result['scopes'] = scopes === UNREADABLE ? [] : scopes;
  return result;
}

/** Kind and ids only, picked by name: nothing else on the actor object reaches the line. */
function projectActor(actor: unknown, problems: Problems): Line {
  const result = emptyObject();
  const kind = property(actor, 'kind');
  switch (kind) {
    case 'user': {
      result['kind'] = kind;
      result['user_id'] = idOrInvalid(property(actor, 'userId'), problems);
      const via = property(actor, 'via');
      if (via !== undefined) result['via'] = aiClient(via, problems);
      break;
    }
    case 'service_account':
      result['kind'] = kind;
      result['service_account_id'] = idOrInvalid(property(actor, 'serviceAccountId'), problems);
      break;
    case 'operator':
      result['kind'] = kind;
      result['operator_id'] = idOrInvalid(property(actor, 'operatorId'), problems);
      result['support_session_id'] = idOrInvalid(property(actor, 'supportSessionId'), problems);
      break;
    case 'system': {
      const process = property(actor, 'process');
      result['kind'] = kind;
      result['process'] =
        typeof process === 'string' && PROCESS_PATTERN.test(process) && isUnchangedByScrub(process)
          ? process
          : invalid(problems);
      break;
    }
    case 'anonymous':
      result['kind'] = kind;
      break;
    default:
      result['kind'] = invalid(problems);
  }
  return result;
}

function envelope(
  level: LogLevel,
  context: Context,
  event: string,
  module: ModuleId | undefined,
  problems: Problems,
): Line {
  const line = emptyObject();
  line['ts'] = timestamp(context, problems);
  line['level'] = level;
  line['event'] = eventName(event, problems);
  if (module !== undefined) line['module'] = module;
  // The id may have been chosen by a client or carried on a queued job, so its format alone
  // is not enough: one that looks like a phone number or an id is not written.
  const correlation = parseCorrelationId(property(context, 'correlationId'));
  line['correlation_id'] =
    correlation !== undefined && isUnchangedByScrub(correlation) ? correlation : invalid(problems);
  const tenantId = property(context, 'tenantId');
  line['tenant_id'] = tenantId === undefined ? null : idOrInvalid(tenantId, problems);
  line['actor'] = projectActor(property(context, 'actor'), problems);
  const initiatedBy = property(context, 'initiatedBy');
  if (initiatedBy !== undefined) line['initiated_by'] = projectActor(initiatedBy, problems);
  const causationId = property(context, 'causationId');
  if (causationId !== undefined) line['causation_id'] = idOrInvalid(causationId, problems);
  return line;
}

function omitted(value: unknown): string {
  if (Array.isArray(value)) return '[omitted:array]';
  return `[omitted:${typeof value}]`;
}

function redactValue(
  key: string,
  value: unknown,
  context: Context,
  lookup: ClassificationLookup,
  problems: Problems,
): LogScalar {
  let inner = value;
  const wrapped = ClassifiedValue.unwrap(value);
  if (wrapped !== undefined) {
    const classification = classifyField(lookup, context, wrapped.field, () => {
      problems.classification_errors += 1;
    });
    if (classification !== 'public' && classification !== 'internal') return `[${classification}]`;
    inner = wrapped.value;
  }
  if (inner instanceof Secret) return '[secret]';
  if (typeof inner === 'string' || typeof inner === 'number') {
    const denied = deniedKeyToken(key);
    if (denied !== undefined) return denied;
  }
  if (typeof inner === 'string') return scrubText(inner);
  if (typeof inner === 'number') return Number.isFinite(inner) ? inner : '[omitted:number]';
  if (typeof inner === 'boolean' || inner === null) return inner;
  return omitted(inner);
}

function redactFields(
  fields: unknown,
  context: Context,
  lookup: ClassificationLookup,
  problems: Problems,
): [string, LogScalar][] {
  if (fields === undefined) return [];
  const keys =
    typeof fields === 'object' && fields !== null ? attempt(() => Object.keys(fields)) : UNREADABLE;
  if (keys === UNREADABLE) {
    problems.dropped_fields += 1;
    return [];
  }
  const entries: [string, LogScalar][] = [];
  for (const key of keys) {
    if (entries.length >= LOG_MAX_FIELDS || !KEY_PATTERN.test(key) || !isUnchangedByScrub(key)) {
      problems.dropped_fields += 1;
      continue;
    }
    const redacted = attempt(() =>
      redactValue(key, (fields as Record<string, unknown>)[key], context, lookup, problems),
    );
    entries.push([key, redacted === UNREADABLE ? UNREADABLE_VALUE : redacted]);
  }
  return entries;
}

/** The fields as an object without a prototype, so no key can reach `Object.prototype`. */
function fieldsObject(entries: readonly (readonly [string, LogScalar])[]): Line {
  const result = emptyObject();
  for (const [key, value] of entries) result[key] = value;
  return result;
}

function problemsOrNothing(problems: Problems): Line | undefined {
  const result = emptyObject();
  if (problems.classification_errors > 0) {
    result['classification_errors'] = problems.classification_errors;
  }
  if (problems.dropped_fields > 0) result['dropped_fields'] = problems.dropped_fields;
  if (problems.invalid_context > 0) result['invalid_context'] = problems.invalid_context;
  if (problems.invalid_event) result['invalid_event'] = true;
  if (problems.clock_failed) result['clock_failed'] = true;
  if (problems.error_compacted) result['error_compacted'] = true;
  return Object.keys(result).length === 0 ? undefined : result;
}

/**
 * A copy with no prototypes anywhere, so a polluted `Object.prototype.toJSON` or
 * `Array.prototype.toJSON` cannot replace what is written.
 */
function detach(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.setPrototypeOf((value as unknown[]).map(detach), null) as unknown;
  }
  if (typeof value === 'object' && value !== null) {
    const copy = emptyObject();
    for (const [key, item] of Object.entries(value)) copy[key] = detach(item);
    return copy;
  }
  return value;
}

function serialise(line: Line): string {
  return JSON.stringify(detach(line)).replace(
    UNSAFE_LINE_CHARACTERS,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

function utf8Length(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff && index + 1 < text.length) {
      // A surrogate pair is one 4-byte character.
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

const newProblems = (): Problems => ({
  classification_errors: 0,
  dropped_fields: 0,
  invalid_context: 0,
  invalid_event: false,
  clock_failed: false,
  error_compacted: false,
});

function finish(line: Line, problems: Problems, extra?: Line): string {
  const found = problemsOrNothing(problems);
  return serialise({ ...line, ...extra, ...(found === undefined ? {} : { problems: found }) });
}

function buildLine(
  level: LogLevel,
  context: Context,
  event: string,
  data: LogData | undefined,
  module: ModuleId | undefined,
  lookup: ClassificationLookup,
): string {
  const problems = newProblems();
  const head = envelope(level, context, event, module, problems);
  const entries = redactFields(data?.fields, context, lookup, problems);
  let error = data?.error === undefined ? undefined : summariseError(data.error);
  // An error that would take more than half the line keeps its types and codes only, so the
  // fields that say which record it was still fit.
  if (
    error !== undefined &&
    utf8Length(finish(head, problems, { error })) > LOG_MAX_LINE_BYTES / 2
  ) {
    error = compactErrorSummary(error);
    problems.error_compacted = true;
  }

  // Drop fields from the end until the line fits the byte budget.
  for (;;) {
    const body = emptyObject();
    if (entries.length > 0) body['fields'] = fieldsObject(entries);
    if (error !== undefined) body['error'] = error;
    const text = finish(head, problems, body);
    if (utf8Length(text) <= LOG_MAX_LINE_BYTES) return text;
    if (entries.pop() === undefined) break;
    problems.dropped_fields += 1;
  }
  // The envelope and the error summary are bounded, so this is not expected to happen.
  return finish(head, problems, { oversize: true });
}

/** Level, event and ids only, for a line whose payload could not be redacted. */
function fallbackLine(
  level: LogLevel,
  context: Context,
  event: string,
  module: ModuleId | undefined,
): string {
  const problems = newProblems();
  return finish(envelope(level, context, event, module, problems), problems, {
    redaction_failed: true,
  });
}

const LEVEL_RANK: Readonly<Record<LogLevel, number>> = Object.freeze({
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
});

/**
 * A logger that writes redacted JSON lines to `sink`. Call it with the context of the work
 * being done; there is no global logger. A log call never throws into the caller.
 */
export function createLogger(options: LoggerOptions): Logger {
  const { sink, classification, module, onSinkError } = options;
  const minLevel = options.minLevel ?? 'info';
  if (typeof sink !== 'function') throw new TypeError('A logger needs a sink function');
  if (typeof classification.classify !== 'function') {
    throw new TypeError('A logger needs a classification lookup');
  }
  if (!LOG_LEVELS.includes(minLevel)) throw new TypeError('Unknown minimum log level');
  if (module !== undefined && !isModuleId(module)) throw new TypeError('Unknown module id');

  let reporting = false;
  const report = (cause: unknown): void => {
    // A reporter that logs through this logger must not start a loop.
    if (reporting) return;
    reporting = true;
    try {
      onSinkError?.(cause);
    } catch {
      // The reporter failed too; there is nowhere left to report to, and the caller's
      // work must not fail because logging did.
    } finally {
      reporting = false;
    }
  };
  const emit = (line: string): void => {
    // A line written while a failure is being reported does not report its own failure
    // later, or a reporter that logs to a rejecting sink would never stop.
    const quiet = reporting;
    try {
      const pending = sink(line);
      if (
        typeof pending === 'object' &&
        pending !== null &&
        typeof (pending as { then?: unknown }).then === 'function'
      ) {
        void (pending as PromiseLike<unknown>).then(undefined, (cause: unknown) => {
          if (!quiet) report(cause);
        });
      }
    } catch (cause) {
      report(cause);
    }
  };

  const write = (level: LogLevel, context: Context, event: string, data?: LogData): void => {
    if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;
    let line: string;
    try {
      line = buildLine(level, context, event, data, module, classification);
    } catch {
      const fallback = attempt(() => fallbackLine(level, context, event, module));
      line = fallback === UNREADABLE ? LAST_RESORT_LINE : fallback;
    }
    emit(line);
  };

  return Object.freeze({
    debug: (context: Context, event: string, data?: LogData) => {
      write('debug', context, event, data);
    },
    info: (context: Context, event: string, data?: LogData) => {
      write('info', context, event, data);
    },
    warn: (context: Context, event: string, data?: LogData) => {
      write('warn', context, event, data);
    },
    error: (context: Context, event: string, data?: LogData) => {
      write('error', context, event, data);
    },
  });
}
