import {
  createIdGenerator,
  err,
  maskAddress,
  ok,
  validateOutgoing,
  type AppError,
  type AuditRecord,
  type AuditSink,
  type Clock,
  type EventEnvelope,
  type EventPublisher,
  type Id,
  type IdGenerator,
  type MessageSender,
  type OutgoingMessage,
  type TenantId,
} from '@gx/core';

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const ids = (clock: Clock): IdGenerator => createIdGenerator({ clock });

/** One injected failure, for tests of the caller's fail-closed handling. */
export interface FailureInjection {
  failNext(error: AppError): void;
}

export interface FakeAuditSink extends AuditSink, FailureInjection {
  records(tenantId: TenantId): Promise<readonly AuditRecord[]>;
}

export function fakeAuditSink(options: { readonly clock: Clock }): FakeAuditSink {
  const nextId = ids(options.clock);
  const stored: AuditRecord[] = [];
  let failure: AppError | undefined;
  return {
    append(context, entry) {
      if (failure !== undefined) {
        const error = failure;
        failure = undefined;
        return Promise.resolve(err(error));
      }
      const record: AuditRecord = deepFreeze({
        ...structuredClone(entry),
        id: nextId(),
        tenantId: context.tenantId,
        actor: structuredClone(context.actor),
        ...(context.initiatedBy === undefined
          ? {}
          : { initiatedBy: structuredClone(context.initiatedBy) }),
        correlationId: context.correlationId,
        at: context.clock.nowMillis(),
      });
      stored.push(record);
      return Promise.resolve(ok({ id: record.id }));
    },
    records: (tenantId) =>
      Promise.resolve(stored.filter((r) => r.tenantId === tenantId).map((r) => structuredClone(r))),
    failNext(error) {
      failure = error;
    },
  };
}

export interface FakeEventPublisher extends EventPublisher, FailureInjection {
  published(tenantId: TenantId): Promise<readonly EventEnvelope[]>;
}

export function fakeEventPublisher(options: { readonly clock: Clock }): FakeEventPublisher {
  const nextId = ids(options.clock);
  const stored: EventEnvelope[] = [];
  let failure: AppError | undefined;
  return {
    publish(context, event) {
      if (failure !== undefined) {
        const error = failure;
        failure = undefined;
        return Promise.resolve(err(error));
      }
      const envelope: EventEnvelope = deepFreeze({
        type: event.type,
        version: event.version,
        payload: structuredClone(event.payload),
        id: nextId(),
        tenantId: context.tenantId,
        actor: structuredClone(context.actor),
        ...(context.initiatedBy === undefined
          ? {}
          : { initiatedBy: structuredClone(context.initiatedBy) }),
        correlationId: context.correlationId,
        ...(context.causationId === undefined ? {} : { causationId: context.causationId }),
        occurredAt: context.clock.nowMillis(),
      });
      stored.push(envelope);
      return Promise.resolve(ok(envelope));
    },
    published: (tenantId) =>
      Promise.resolve(stored.filter((e) => e.tenantId === tenantId).map((e) => structuredClone(e))),
    failNext(error) {
      failure = error;
    },
  };
}

export interface SentMessage extends Omit<OutgoingMessage, 'to'> {
  readonly messageId: Id;
  /** Masked: only the last 2 characters are kept. */
  readonly to: string;
}

export interface FakeMessageSender extends MessageSender, FailureInjection {
  sent(tenantId: TenantId): Promise<readonly SentMessage[]>;
}

export function fakeMessageSender(options: { readonly clock: Clock }): FakeMessageSender {
  const nextId = ids(options.clock);
  const stored: { tenantId: TenantId; message: SentMessage }[] = [];
  let failure: AppError | undefined;
  return {
    send(context, message) {
      const invalid = validateOutgoing(message);
      if (invalid !== undefined) return Promise.resolve(err(invalid));
      if (failure !== undefined) {
        const error = failure;
        failure = undefined;
        return Promise.resolve(err(error));
      }
      const messageId = nextId();
      stored.push({
        tenantId: context.tenantId,
        message: deepFreeze({
          ...structuredClone(message),
          to: maskAddress(message.to),
          messageId,
        }),
      });
      return Promise.resolve(ok({ messageId }));
    },
    sent: (tenantId) =>
      Promise.resolve(
        stored.filter((s) => s.tenantId === tenantId).map((s) => structuredClone(s.message)),
      ),
    failNext(error) {
      failure = error;
    },
  };
}
