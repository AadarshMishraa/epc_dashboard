import type { Actor, CorrelationId, TenantContext, TenantId } from '../context.ts';
import type { AppError } from '../errors.ts';
import type { Id } from '../ids.ts';
import type { Result } from '../result.ts';

export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface EventInput {
  /** `entity.past_tense_verb`, declared with its version in the emitter's manifest. */
  readonly type: string;
  readonly version: number;
  readonly payload: { readonly [key: string]: JsonValue };
}

/** The envelope (development guidelines 10). Tenant and actor come from the context, never the payload. */
export interface EventEnvelope extends EventInput {
  readonly id: Id;
  readonly tenantId: TenantId;
  readonly actor: Actor;
  readonly initiatedBy?: Actor;
  readonly correlationId: CorrelationId;
  readonly causationId?: Id;
  readonly occurredAt: number;
}

/** Publishes through the outbox, in the transaction that changed the state. Implemented by K6. */
export interface EventPublisher {
  publish(context: TenantContext, event: EventInput): Promise<Result<EventEnvelope, AppError>>;
}
