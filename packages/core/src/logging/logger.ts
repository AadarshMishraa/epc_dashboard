import type { Actor, Context } from '../context.ts';
import {
  classifyField,
  type Classification,
  type ClassificationLookup,
} from '../ports/classification.ts';
import { LIMITS, redactString, redactValue } from './redact.ts';

export const LOG_LEVELS = Object.freeze(['debug', 'info', 'warn', 'error'] as const);
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Where log lines go. Each call gets one complete JSON line, already redacted. */
export interface LogSink {
  write(line: string): void;
}

export interface LogCallOptions {
  /** The entity the fields belong to, so each field is classified (personal, secret and so on). */
  readonly entity?: string;
}

export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
  debug(event: string, fields?: LogFields, options?: LogCallOptions): void;
  info(event: string, fields?: LogFields, options?: LogCallOptions): void;
  warn(event: string, fields?: LogFields, options?: LogCallOptions): void;
  error(event: string, fields?: LogFields, options?: LogCallOptions): void;
}

export interface LoggerOptions {
  readonly sink: LogSink;
  /**
   * Field classifications (K4). A call that names an entity is classified through it;
   * without it, every field of such a call is treated as secret.
   */
  readonly classification?: ClassificationLookup;
  readonly minLevel?: LogLevel;
  /** Longest line kept; past it, fields are dropped and the line says so. */
  readonly maxLineChars?: number;
  /** The sink threw, a lookup failed or the line could not be built; the logger never throws. */
  readonly onFailure?: (cause: unknown) => void;
}

/** Dotted snake_case event keys, such as `invoice.issue_failed`. */
const EVENT = /^[a-z0-9_]{1,40}(?:\.[a-z0-9_]{1,40}){0,4}$/;
const INVALID_EVENT = 'log.invalid_event';

/** An event key must be dotted snake_case and hold nothing the backstop would mask. */
function eventKey(event: string): string {
  return EVENT.test(event) && redactString(event) === event ? event : INVALID_EVENT;
}
const DEFAULT_MAX_LINE_CHARS = 16_384;
const MIN_LINE_CHARS = 1_024;
/** Room kept for `"fields":{}`, `fields_omitted` and JSON escapes the walk cannot see. */
const FIELDS_OVERHEAD = 256;
const RANK: Readonly<Record<LogLevel, number>> = { debug: 0, info: 1, warn: 2, error: 3 };
const MASK: Readonly<Partial<Record<Classification, string>>> = {
  personal: '[personal]',
  sensitive_personal: '[redacted]',
  secret: '[redacted]',
};

/** Ids and kinds only. An AI client id is a URL the client controls, so it goes through the backstop. */
function describeActor(actor: Actor): Record<string, unknown> {
  switch (actor.kind) {
    case 'user':
      return actor.via === undefined
        ? { kind: 'user', id: actor.userId }
        : {
            kind: 'user',
            id: actor.userId,
            via: {
              kind: 'ai_client',
              id: redactString(actor.via.clientId),
              scopes: [...actor.via.scopes],
            },
          };
    case 'service_account':
      return { kind: 'service_account', id: actor.serviceAccountId };
    case 'operator':
      return { kind: 'operator', id: actor.operatorId, support_session: actor.supportSessionId };
    case 'system':
      return { kind: 'system', process: redactString(actor.process) };
    case 'anonymous':
      return { kind: 'anonymous' };
  }
}

const cp = (code: number): string => String.fromCodePoint(code);
const span = (from: number, to: number): string => `${cp(from)}-${cp(to)}`;
/**
 * Characters JSON leaves raw that a log viewer may act on: DEL and C1 controls (CSI starts a
 * terminal sequence), the line and paragraph separators, zero-width and bidirectional marks
 * (an override can make a line read backwards), and the byte-order mark.
 */
const UNSAFE = new RegExp(
  `[${span(0x7f, 0x9f)}${cp(0x061c)}${span(0x200b, 0x200f)}${span(0x2028, 0x202e)}${span(0x2066, 0x2069)}${cp(0xfeff)}]`,
  'g',
);

function escapeUnsafe(char: string): string {
  return `\\u${(char.codePointAt(0) ?? 0).toString(16).padStart(4, '0')}`;
}

/** One JSON line; JSON escapes C0 controls, and every other unsafe character is escaped too. */
function oneLine(record: Record<string, unknown>): string {
  return JSON.stringify(record).replace(UNSAFE, escapeUnsafe);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

/**
 * A logger bound to one context: every line carries its tenant, actor, initiating actor,
 * correlation and causation ids, and callers cannot override them (fields are nested under
 * `fields`). When a call names an entity, each field is classified: personal is masked,
 * sensitive and secret are removed, and an unknown field is secret. Every value then goes
 * through the redaction backstop. The logger never throws: a line it cannot build becomes a
 * fallback line with `redaction_failed: true` and no payload.
 */
export function createLogger(context: Context, options: LoggerOptions): Logger {
  const minRank = RANK[options.minLevel ?? 'info'];
  const maxChars = Math.max(options.maxLineChars ?? DEFAULT_MAX_LINE_CHARS, MIN_LINE_CHARS);
  const report = (cause: unknown): void => {
    try {
      options.onFailure?.(cause);
    } catch {
      // A failing failure handler has nowhere left to report to.
    }
  };

  const ids = (): Record<string, unknown> => ({
    ...(context.tenantId === undefined ? {} : { tenant_id: context.tenantId }),
    // A correlation id can arrive in a request header, so it gets the backstop too.
    correlation_id: redactString(context.correlationId),
    ...(context.causationId === undefined ? {} : { causation_id: context.causationId }),
  });

  const header = (level: LogLevel, event: string): Record<string, unknown> => ({
    ts: new Date(context.clock.nowMillis()).toISOString(),
    level,
    event: eventKey(event),
    ...ids(),
    actor: describeActor(context.actor),
    ...(context.initiatedBy === undefined
      ? {}
      : { initiated_by: describeActor(context.initiatedBy) }),
  });

  const classification = (entity: string, field: string): Classification => {
    const lookup = options.classification;
    if (lookup === undefined) return 'secret';
    return classifyField(lookup, context, { entity, field }, report);
  };

  /** The top-level fields, classified when an entity is named, before the backstop runs. */
  const shape = (
    fields: unknown,
    entity: string | undefined,
  ): {
    shaped: Record<string, unknown>;
    classified: ReadonlySet<string>;
    omitted: number;
  } => {
    const classified = new Set<string>();
    if (fields === undefined) return { shaped: {}, classified, omitted: 0 };
    // An Error, class instance or array passed as fields is one value, never a field map.
    if (!isPlainObject(fields)) return { shaped: { value: fields }, classified, omitted: 0 };
    const keys = Object.keys(fields);
    const shaped: Record<string, unknown> = {};
    for (const key of keys.slice(0, LIMITS.breadth)) {
      if (entity !== undefined) classified.add(key);
      const mask = entity === undefined ? undefined : MASK[classification(entity, key)];
      if (mask !== undefined) {
        setOwn(shaped, key, mask);
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(fields, key);
      setOwn(
        shaped,
        key,
        descriptor !== undefined && 'value' in descriptor ? descriptor.value : '[getter]',
      );
    }
    return { shaped, classified, omitted: Math.max(keys.length - LIMITS.breadth, 0) };
  };

  const timestamp = (): Record<string, unknown> => {
    try {
      return { ts: new Date(context.clock.nowMillis()).toISOString() };
    } catch {
      return {};
    }
  };

  const fallback = (level: LogLevel, event: string): string => {
    try {
      return oneLine({
        ...timestamp(),
        level,
        event: eventKey(event),
        ...ids(),
        redaction_failed: true,
      });
    } catch {
      // The context itself is broken: say so with constants only. `level` is one of ours.
      return `{"level":"${level}","event":"log.redaction_failed","redaction_failed":true}`;
    }
  };

  const log = (level: LogLevel, event: string, fields?: LogFields, call?: LogCallOptions): void => {
    if (RANK[level] < minRank) return;
    let line: string;
    try {
      const head = header(level, event);
      const { shaped, classified, omitted } = shape(fields, call?.entity);
      // The walk stops at the room the header leaves, so a huge value costs no more than a line.
      const room = Math.max(maxChars - oneLine(head).length - FIELDS_OVERHEAD, 0);
      const redacted = redactValue(shaped, { maxChars: room, classifiedKeys: classified });
      const body: Record<string, unknown> = { ...head, fields: redacted ?? {} };
      if (omitted > 0) body['fields_omitted'] = omitted;
      line = oneLine(body);
      if (line.length > maxChars) {
        line = oneLine({ ...head, fields: {}, fields_dropped: 'line_too_long' });
      }
    } catch (cause) {
      report(cause);
      line = fallback(level, event);
    }
    try {
      options.sink.write(line);
    } catch (cause) {
      report(cause);
    }
  };

  return Object.freeze({
    debug: (event: string, fields?: LogFields, call?: LogCallOptions) => {
      log('debug', event, fields, call);
    },
    info: (event: string, fields?: LogFields, call?: LogCallOptions) => {
      log('info', event, fields, call);
    },
    warn: (event: string, fields?: LogFields, call?: LogCallOptions) => {
      log('warn', event, fields, call);
    },
    error: (event: string, fields?: LogFields, call?: LogCallOptions) => {
      log('error', event, fields, call);
    },
  });
}
