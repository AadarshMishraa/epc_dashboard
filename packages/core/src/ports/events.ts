import {
  freezeActor,
  type Actor,
  type CorrelationId,
  type TenantContext,
  type TenantId,
} from '../context.ts';
import { coreError, type AppError, type FieldError } from '../errors.ts';
import type { Id } from '../ids.ts';
import { err, ok, type Result } from '../result.ts';
import { toFrozenJson, type JsonValue } from './json.ts';
import { isDottedName } from './names.ts';

export interface EventInput {
  /** `entity.past_tense_verb` as declared in the module manifest, for example `invoice.issued`. */
  readonly name: string;
  /** The payload schema version, from 1; a breaking change is a new version (K6-T01). */
  readonly version: number;
  /** Plain JSON. Copied and frozen on publish, so later changes by the caller are not seen. */
  readonly payload: unknown;
}

declare const preparedEventBrand: unique symbol;

/** An event that passed `prepareEvent`; only that function produces one. */
export type PreparedEvent = {
  readonly name: string;
  readonly version: number;
  readonly payload: JsonValue;
} & { readonly [preparedEventBrand]: true };

export interface EventEnvelope {
  readonly id: Id;
  readonly name: string;
  readonly version: number;
  /** Always the publishing context's tenant, whatever the payload says. */
  readonly tenantId: TenantId;
  readonly actor: Actor;
  readonly initiatedBy?: Actor;
  readonly correlationId: CorrelationId;
  readonly causationId?: Id;
  readonly occurredAtMillis: number;
  readonly payload: JsonValue;
}

/**
 * Publishes a domain event for the context's tenant. Implemented by K6 as a transactional
 * outbox. Adapters build the envelope with `prepareEvent` and `createEventEnvelope`, so the
 * tenant always comes from the context and the payload is frozen.
 */
export interface EventPublisher {
  publish(context: TenantContext, event: EventInput): Promise<Result<EventEnvelope, AppError>>;
}

export function prepareEvent(
  event: EventInput,
): Result<PreparedEvent, AppError<'VALIDATION_FAILED'>> {
  const fields: FieldError[] = [];
  if (!isDottedName(event.name)) fields.push({ path: 'name', code: 'invalid_name' });
  if (!(Number.isSafeInteger(event.version) && event.version >= 1)) {
    fields.push({ path: 'version', code: 'invalid_version' });
  }
  const payload = toFrozenJson(event.payload);
  if (!payload.ok) {
    for (const field of payload.error.fields) {
      fields.push({
        path: field.path === '' ? 'payload' : `payload.${field.path}`,
        code: field.code,
      });
    }
  }
  if (fields.length > 0 || !payload.ok) {
    return err(coreError('VALIDATION_FAILED', { fields, detail: 'invalid event' }));
  }
  return ok(
    Object.freeze({
      name: event.name,
      version: event.version,
      payload: payload.value,
    }) as PreparedEvent,
  );
}

export function createEventEnvelope(
  context: TenantContext,
  event: PreparedEvent,
  id: Id,
): EventEnvelope {
  return Object.freeze({
    id,
    name: event.name,
    version: event.version,
    tenantId: context.tenantId,
    actor: freezeActor(context.actor),
    ...(context.initiatedBy === undefined ? {} : { initiatedBy: freezeActor(context.initiatedBy) }),
    correlationId: context.correlationId,
    ...(context.causationId === undefined ? {} : { causationId: context.causationId }),
    occurredAtMillis: context.clock.nowMillis(),
    payload: event.payload,
  });
}
