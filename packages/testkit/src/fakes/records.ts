import {
  coreError,
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
  type MessageChannel,
  type MessageSender,
  type Result,
  type TenantId,
} from '@gx/core';

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** A deep copy, or a validation error when the value cannot be stored (functions, symbols). */
function copy<T>(value: T): Result<T, AppError<'VALIDATION_FAILED'>> {
  try {
    return ok(structuredClone(value));
  } catch (error) {
    return err(
      coreError('VALIDATION_FAILED', {
        detail: 'the value cannot be stored as data',
        cause: error,
      }),
    );
  }
}

const ids = (clock: Clock): IdGenerator => createIdGenerator({ clock });

/** One injected failure, for tests of the caller's fail-closed handling. */
export interface FailureInjection {
  failNext(error: AppError): void;
}

function injector(): { take(): AppError | undefined; failNext(error: AppError): void } {
  let failure: AppError | undefined;
  return {
    take() {
      const error = failure;
      failure = undefined;
      return error;
    },
    failNext(error) {
      failure = error;
    },
  };
}

export interface FakeAuditSink extends AuditSink, FailureInjection {
  records(tenantId: TenantId): Promise<readonly AuditRecord[]>;
}

/** Builds each record from named fields only, so an entry cannot smuggle in who or where. */
export function fakeAuditSink(options: { readonly clock: Clock }): FakeAuditSink {
  const nextId = ids(options.clock);
  const stored: AuditRecord[] = [];
  const failures = injector();
  return {
    append(context, entry) {
      const injected = failures.take();
      if (injected !== undefined) return Promise.resolve(err(injected));
      const changes = entry.changes === undefined ? ok(undefined) : copy(entry.changes);
      if (!changes.ok) return Promise.resolve(changes);
      const record: AuditRecord = deepFreeze({
        id: nextId(),
        action: entry.action,
        resource: {
          type: entry.resource.type,
          ...(entry.resource.id === undefined ? {} : { id: entry.resource.id }),
        },
        outcome: entry.outcome,
        ...(changes.value === undefined ? {} : { changes: changes.value }),
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
    failNext: (error) => {
      failures.failNext(error);
    },
  };
}

export interface FakeEventPublisher extends EventPublisher, FailureInjection {
  published(tenantId: TenantId): Promise<readonly EventEnvelope[]>;
}

export function fakeEventPublisher(options: { readonly clock: Clock }): FakeEventPublisher {
  const nextId = ids(options.clock);
  const stored: EventEnvelope[] = [];
  const failures = injector();
  return {
    publish(context, event) {
      const injected = failures.take();
      if (injected !== undefined) return Promise.resolve(err(injected));
      const payload = copy(event.payload);
      if (!payload.ok) return Promise.resolve(payload);
      const envelope: EventEnvelope = deepFreeze({
        id: nextId(),
        type: event.type,
        version: event.version,
        payload: payload.value,
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
    failNext: (error) => {
      failures.failNext(error);
    },
  };
}

/** What a sender keeps: no recipient in clear, no parameter values (they can be personal data). */
export interface SentMessage {
  readonly messageId: Id;
  readonly channel: MessageChannel;
  /** Masked: only the last 2 characters are kept. */
  readonly to: string;
  readonly template: string;
  readonly paramNames: readonly string[];
  readonly purpose: string;
  readonly consentRef: string;
}

export interface FakeMessageSender extends MessageSender, FailureInjection {
  sent(tenantId: TenantId): Promise<readonly SentMessage[]>;
}

export function fakeMessageSender(options: { readonly clock: Clock }): FakeMessageSender {
  const nextId = ids(options.clock);
  const stored: { tenantId: TenantId; message: SentMessage }[] = [];
  const failures = injector();
  return {
    send(context, message) {
      const invalid = validateOutgoing(message);
      if (invalid !== undefined) return Promise.resolve(err(invalid));
      const injected = failures.take();
      if (injected !== undefined) return Promise.resolve(err(injected));
      const messageId = nextId();
      stored.push({
        tenantId: context.tenantId,
        message: deepFreeze({
          messageId,
          channel: message.channel,
          to: maskAddress(message.to),
          template: message.template,
          paramNames: Object.keys(message.params).sort(),
          purpose: message.purpose,
          consentRef: message.consentRef,
        }),
      });
      return Promise.resolve(ok({ messageId }));
    },
    sent: (tenantId) =>
      Promise.resolve(
        stored.filter((s) => s.tenantId === tenantId).map((s) => structuredClone(s.message)),
      ),
    failNext: (error) => {
      failures.failNext(error);
    },
  };
}
