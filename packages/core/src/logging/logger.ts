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
const DEFAULT_MAX_LINE_CHARS = 16_384;
const MIN_LINE_CHARS = 1_024;
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

/** U+2028 and U+2029 are valid in JSON but end a line in some viewers; escape them too. */
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g');
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g');

function oneLine(record: Record<string, unknown>): string {
  return JSON.stringify(record)
    .replace(LINE_SEPARATOR, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR, '\\u2029');
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
    event: EVENT.test(event) ? event : INVALID_EVENT,
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
    omitted: number;
  } => {
    if (fields === undefined) return { shaped: {}, omitted: 0 };
    // An Error, class instance or array passed as fields is one value, never a field map.
    if (!isPlainObject(fields)) return { shaped: { value: fields }, omitted: 0 };
    const keys = Object.keys(fields);
    const shaped: Record<string, unknown> = {};
    for (const key of keys.slice(0, LIMITS.breadth)) {
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
    return { shaped, omitted: Math.max(keys.length - LIMITS.breadth, 0) };
  };

  const fallback = (level: LogLevel, event: string): string => {
    try {
      return oneLine({
        level,
        event: EVENT.test(event) ? event : INVALID_EVENT,
        ...ids(),
        redaction_failed: true,
      });
    } catch {
      return '{"event":"log.redaction_failed","redaction_failed":true}';
    }
  };

  const log = (level: LogLevel, event: string, fields?: LogFields, call?: LogCallOptions): void => {
    if (RANK[level] < minRank) return;
    let line: string;
    try {
      const head = header(level, event);
      const { shaped, omitted } = shape(fields, call?.entity);
      const body: Record<string, unknown> = { ...head, fields: redactValue(shaped) ?? {} };
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
