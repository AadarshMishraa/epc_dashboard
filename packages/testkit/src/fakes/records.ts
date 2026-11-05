import {
  coreError,
  createAuditRecord,
  createEventEnvelope,
  createIdGenerator,
  err,
  isEraserHandlerId,
  isErasureComplete,
  maskRecipient,
  ok,
  prepareAuditEntry,
  prepareEvent,
  prepareMessage,
  runEraser,
  Secret,
  systemClock,
  type AppError,
  type AuditEntry,
  type AuditRecord,
  type AuditSink,
  type EraserHandler,
  type EraserRegistry,
  type ErasureOutcome,
  type ErasureReport,
  type ErasureSubject,
  type EventEnvelope,
  type EventInput,
  type EventPublisher,
  type IdGenerator,
  type MessageSender,
  type OutboundMessage,
  type Result,
  type SecretError,
  type PlatformSecretsProvider,
  type TenantSecretsProvider,
  type SentMessage,
  type TenantContext,
  type TenantId,
} from '@gx/core';
import type { SecretsSeed } from '../contracts/records.ts';

const key = (...parts: readonly string[]): string => JSON.stringify(parts);

export interface RecordingFakeOptions {
  /** Ids for stored records; defaults to a UUIDv7 generator on the system clock. */
  readonly ids?: IdGenerator;
}

/** Per-tenant append-only storage with one-shot failure injection, shared by the recording fakes. */
class TenantLog<R> {
  readonly #byTenant = new Map<TenantId, R[]>();
  #nextFailure: AppError | undefined;

  failNext(error: AppError): void {
    this.#nextFailure = error;
  }

  takeFailure(): AppError | undefined {
    const failure = this.#nextFailure;
    this.#nextFailure = undefined;
    return failure;
  }

  append(tenantId: TenantId, record: R): void {
    const records = this.#byTenant.get(tenantId) ?? [];
    records.push(record);
    this.#byTenant.set(tenantId, records);
  }

  read(tenantId: TenantId): readonly R[] {
    return Object.freeze([...(this.#byTenant.get(tenantId) ?? [])]);
  }
}

/** In-memory tenant secrets. Another tenant's secret is NOT_FOUND, the same answer as a missing one. */
export class FakeTenantSecretsProvider implements TenantSecretsProvider {
  readonly #secrets = new Map<string, Secret>();

  constructor(seed: Partial<Pick<SecretsSeed, 'tenantSecrets'>> = {}) {
    for (const { tenantId, name, value } of seed.tenantSecrets ?? [])
      this.set(tenantId, name, value);
  }

  set(tenantId: TenantId, name: string, value: string): void {
    this.#secrets.set(key(tenantId, name), new Secret(value));
  }

  get(context: TenantContext, name: string): Promise<Result<Secret, SecretError>> {
    return Promise.resolve(found(this.#secrets.get(key(context.tenantId, name))));
  }
}

/** In-memory platform secrets, separate from any tenant's. */
export class FakePlatformSecretsProvider implements PlatformSecretsProvider {
  readonly #secrets = new Map<string, Secret>();

  constructor(seed: Partial<Pick<SecretsSeed, 'platformSecrets'>> = {}) {
    for (const { name, value } of seed.platformSecrets ?? []) this.set(name, value);
  }

  set(name: string, value: string): void {
    this.#secrets.set(name, new Secret(value));
  }

  get(name: string): Promise<Result<Secret, SecretError>> {
    return Promise.resolve(found(this.#secrets.get(name)));
  }
}

function found(secret: Secret | undefined): Result<Secret, SecretError> {
  return secret === undefined
    ? err(coreError('NOT_FOUND', { detail: 'secret not found' }))
    : ok(secret);
}

/** In-memory AuditSink. `failNext` makes the next append fail, and nothing is stored. */
export class FakeAuditSink implements AuditSink {
  readonly #log = new TenantLog<AuditRecord>();
  readonly #ids: IdGenerator;

  constructor(options: RecordingFakeOptions = {}) {
    this.#ids = options.ids ?? createIdGenerator({ clock: systemClock });
  }

  failNext(error: AppError): void {
    this.#log.failNext(error);
  }

  records(tenantId: TenantId): readonly AuditRecord[] {
    return this.#log.read(tenantId);
  }

  append(context: TenantContext, entry: AuditEntry): Promise<Result<AuditRecord, AppError>> {
    const failure = this.#log.takeFailure();
    if (failure !== undefined) return Promise.resolve(err(failure));
    const prepared = prepareAuditEntry(entry);
    if (!prepared.ok) return Promise.resolve(prepared);
    const record = createAuditRecord(context, prepared.value, this.#ids());
    this.#log.append(context.tenantId, record);
    return Promise.resolve(ok(record));
  }
}

/** In-memory EventPublisher. `failNext` makes the next publish fail, and nothing is stored. */
export class FakeEventPublisher implements EventPublisher {
  readonly #log = new TenantLog<EventEnvelope>();
  readonly #ids: IdGenerator;

  constructor(options: RecordingFakeOptions = {}) {
    this.#ids = options.ids ?? createIdGenerator({ clock: systemClock });
  }

  failNext(error: AppError): void {
    this.#log.failNext(error);
  }

  published(tenantId: TenantId): readonly EventEnvelope[] {
    return this.#log.read(tenantId);
  }

  publish(context: TenantContext, event: EventInput): Promise<Result<EventEnvelope, AppError>> {
    const failure = this.#log.takeFailure();
    if (failure !== undefined) return Promise.resolve(err(failure));
    const prepared = prepareEvent(event);
    if (!prepared.ok) return Promise.resolve(prepared);
    const envelope = createEventEnvelope(context, prepared.value, this.#ids());
    this.#log.append(context.tenantId, envelope);
    return Promise.resolve(ok(envelope));
  }
}

/** In-memory MessageSender. Sends nothing; records each message with a masked recipient. */
export class FakeMessageSender implements MessageSender {
  readonly #log = new TenantLog<SentMessage>();
  readonly #ids: IdGenerator;

  constructor(options: RecordingFakeOptions = {}) {
    this.#ids = options.ids ?? createIdGenerator({ clock: systemClock });
  }

  failNext(error: AppError): void {
    this.#log.failNext(error);
  }

  sent(tenantId: TenantId): readonly SentMessage[] {
    return this.#log.read(tenantId);
  }

  send(context: TenantContext, message: OutboundMessage): Promise<Result<SentMessage, AppError>> {
    const failure = this.#log.takeFailure();
    if (failure !== undefined) return Promise.resolve(err(failure));
    const prepared = prepareMessage(message);
    if (!prepared.ok) return Promise.resolve(prepared);
    const { channel, to, template, purpose, consentRef } = prepared.value;
    const record: SentMessage = Object.freeze({
      id: this.#ids(),
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      channel,
      recipient: maskRecipient(channel, to),
      template,
      purpose,
      consentRef,
    });
    this.#log.append(context.tenantId, record);
    return Promise.resolve(ok(record));
  }
}

/**
 * In-memory EraserRegistry: refuses duplicate ids, runs every handler through `runEraser`,
 * and reports each outcome. A handler's id and function are read once at registration.
 */
export class FakeEraserRegistry implements EraserRegistry {
  readonly #handlers = new Map<string, EraserHandler['erase']>();

  register(handler: EraserHandler): Result<void, AppError<'CONFLICT' | 'VALIDATION_FAILED'>> {
    const { id } = handler;
    // Read once: swapping handler.erase after registration must not change what runs.
    const erase: unknown = Reflect.get(handler, 'erase');
    if (!isEraserHandlerId(id) || typeof erase !== 'function') {
      return err(
        coreError('VALIDATION_FAILED', {
          fields: [{ path: 'id', code: 'invalid_handler' }],
          detail: 'invalid eraser handler',
        }),
      );
    }
    if (this.#handlers.has(id)) {
      return err(coreError('CONFLICT', { detail: `eraser ${id} is already registered` }));
    }
    const registered = erase as EraserHandler['erase'];
    this.#handlers.set(id, (context, subject) => registered.call(handler, context, subject));
    return ok(undefined);
  }

  async erase(context: TenantContext, subject: ErasureSubject): Promise<ErasureReport> {
    const outcomes: ErasureOutcome[] = [];
    for (const [id, erase] of this.#handlers) {
      outcomes.push(await runEraser(id, erase, context, subject));
    }
    return Object.freeze({
      complete: isErasureComplete(outcomes),
      outcomes: Object.freeze(outcomes),
    });
  }
}
