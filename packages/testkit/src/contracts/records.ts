import {
  coreError,
  deriveContext,
  err,
  isEraserHandlerId,
  ok,
  Secret,
  type AuditRecord,
  type AuditSink,
  type EraserHandler,
  type EraserRegistry,
  type EventEnvelope,
  type EventPublisher,
  type MessageSender,
  type OutboundMessage,
  type PlatformSecretsProvider,
  type TenantSecretsProvider,
  type SentMessage,
  type TenantId,
} from '@gx/core';
import {
  check,
  contextFor,
  deepFrozen,
  EVENT_1,
  FIXTURE_MILLIS,
  RECORD_1,
  sameJson,
  suite,
  TENANT_A,
  TENANT_B,
  user1,
  USER_1,
  type AdapterFactory,
  type ContractSuite,
  type TenantReader,
} from '../contract.ts';

// ---------------------------------------------------------------- SecretsProvider

export interface SecretsSeed {
  readonly tenantSecrets: readonly {
    readonly tenantId: TenantId;
    readonly name: string;
    readonly value: string;
  }[];
  readonly platformSecrets: readonly { readonly name: string; readonly value: string }[];
}

// Obviously fake values, so no fixture looks like a real credential.
const TENANT_VALUE = 'contract-tenant-value';
const PLATFORM_VALUE = 'contract-platform-value';
const NAME = 'SMTP_PASSWORD';

/** Secrets are keyed by tenant and name; another tenant's secret looks exactly like a missing one. */
export interface SecretsUnderTest {
  readonly tenant: TenantSecretsProvider;
  readonly platform: PlatformSecretsProvider;
}

export function secretsProviderContract(
  create: AdapterFactory<SecretsSeed, SecretsUnderTest>,
): ContractSuite {
  const seed: SecretsSeed = {
    tenantSecrets: [{ tenantId: TENANT_A, name: NAME, value: TENANT_VALUE }],
    platformSecrets: [{ name: 'SIGNING_KEY', value: PLATFORM_VALUE }],
  };

  return suite('SecretsProvider', [
    [
      'a tenant reads its own secret as a Secret',
      async () => {
        const { tenant } = await create(seed);
        const result = await tenant.get(contextFor(TENANT_A), NAME);
        check(result.ok, 'expected the seeded secret');
        check(result.value instanceof Secret, 'the value must be a Secret, not a string');
        check(result.value.reveal() === TENANT_VALUE, 'reveal() must return the seeded value');
      },
    ],
    [
      'another tenant gets NOT_FOUND, identical to a missing secret',
      async () => {
        const { tenant } = await create(seed);
        const other = await tenant.get(contextFor(TENANT_B), NAME);
        const missing = await tenant.get(contextFor(TENANT_A), 'NO_SUCH_SECRET');
        check(!other.ok && other.error.code === 'NOT_FOUND', 'another tenant must get NOT_FOUND');
        check(
          !missing.ok && missing.error.code === 'NOT_FOUND',
          'a missing secret must be NOT_FOUND',
        );
        check(
          sameJson(other, missing),
          'another tenant’s secret must look exactly like a missing one',
        );
        check(
          !JSON.stringify(other).includes(TENANT_VALUE),
          'the error must not contain the value',
        );
      },
    ],
    [
      'platform and tenant secrets are separate',
      async () => {
        const { tenant, platform } = await create(seed);
        const platformAsTenant = await tenant.get(contextFor(TENANT_A), 'SIGNING_KEY');
        const tenantAsPlatform = await platform.get(NAME);
        const signingKey = await platform.get('SIGNING_KEY');
        check(!platformAsTenant.ok, 'a platform secret must not be readable as a tenant secret');
        check(!tenantAsPlatform.ok, 'a tenant secret must not be readable as a platform secret');
        check(
          signingKey.ok && signingKey.value.reveal() === PLATFORM_VALUE,
          'expected the platform secret',
        );
      },
    ],
    [
      'a returned secret prints [secret] through String and JSON',
      async () => {
        const { tenant } = await create(seed);
        const result = await tenant.get(contextFor(TENANT_A), NAME);
        check(result.ok, 'expected the seeded secret');
        const printed = `${String(result.value)} ${JSON.stringify({ result })}`;
        check(!printed.includes(TENANT_VALUE), 'the value leaked through String or JSON');
      },
    ],
  ]);
}

// ---------------------------------------------------------------- AuditSink

export interface AuditSinkUnderTest {
  readonly sink: AuditSink;
  readonly read: TenantReader<AuditRecord>;
}

/** Records carry tenant, actor and correlation id from the context, are frozen, and stay in their tenant. */
export function auditSinkContract(
  create: () => AuditSinkUnderTest | Promise<AuditSinkUnderTest>,
): ContractSuite {
  const entry = {
    action: 'invoice.issue',
    outcome: 'succeeded',
    target: { type: 'invoice', id: RECORD_1 },
  } as const;

  return suite('AuditSink', [
    [
      'append stores a record with tenant, actor, correlation id and time from the context',
      async () => {
        const { sink, read } = await create();
        const context = contextFor(TENANT_A);
        const result = await sink.append(context, entry);
        check(result.ok, `append failed: ${result.ok ? '' : result.error.code}`);
        const record = result.value;
        check(record.tenantId === TENANT_A, 'the record must carry the context tenant');
        check(sameJson(record.actor, user1), 'the record must carry the context actor');
        check(
          record.correlationId === context.correlationId,
          'the record must carry the correlation id',
        );
        check(
          record.occurredAtMillis === FIXTURE_MILLIS,
          'the time must come from the context clock',
        );
        check(
          record.action === entry.action && record.outcome === entry.outcome,
          'action and outcome must be kept',
        );
        const stored = await read(TENANT_A);
        check(
          stored.length === 1 && sameJson(stored[0], record),
          'the stored record must be the returned one',
        );
      },
    ],
    [
      'the returned record is frozen, so it cannot be changed after the fact',
      async () => {
        const { sink } = await create();
        const result = await sink.append(contextFor(TENANT_A), entry);
        check(result.ok, 'append failed');
        const record = result.value;
        check(deepFrozen(record), 'the returned record must be deeply frozen');
        let threw = false;
        try {
          (record as { action: string }).action = 'invoice.void';
        } catch {
          threw = true;
        }
        check(threw && record.action === entry.action, 'mutating the record must throw');
      },
    ],
    [
      'records stay in their tenant',
      async () => {
        const { sink, read } = await create();
        await sink.append(contextFor(TENANT_A), entry);
        const other = await read(TENANT_B);
        check(other.length === 0, 'another tenant must see no records');
      },
    ],
    [
      'an invalid entry is refused and nothing is stored',
      async () => {
        const { sink, read } = await create();
        const result = await sink.append(contextFor(TENANT_A), {
          action: 'not dotted',
          outcome: 'succeeded',
        });
        check(
          !result.ok && result.error.code === 'VALIDATION_FAILED',
          'expected VALIDATION_FAILED',
        );
        check((await read(TENANT_A)).length === 0, 'nothing must be stored');
      },
    ],
  ]);
}

// ---------------------------------------------------------------- EventPublisher

export interface EventPublisherUnderTest {
  readonly publisher: EventPublisher;
  readonly read: TenantReader<EventEnvelope>;
}

/** The tenant comes from the context, never the payload; the payload is copied and frozen. */
export function eventPublisherContract(
  create: () => EventPublisherUnderTest | Promise<EventPublisherUnderTest>,
): ContractSuite {
  return suite('EventPublisher', [
    [
      'the tenant comes from the context, even when the payload names another',
      async () => {
        const { publisher, read } = await create();
        const result = await publisher.publish(contextFor(TENANT_A), {
          name: 'invoice.issued',
          version: 1,
          payload: { tenantId: TENANT_B, invoiceId: RECORD_1 },
        });
        check(result.ok, 'publish failed');
        check(result.value.tenantId === TENANT_A, 'the envelope tenant must be the context tenant');
        check((await read(TENANT_B)).length === 0, 'the other tenant must see nothing');
        const stored = await read(TENANT_A);
        check(
          stored.length === 1 && stored[0]?.tenantId === TENANT_A,
          'the event must be stored for the context tenant',
        );
      },
    ],
    [
      'the payload is copied and frozen, so later changes are not seen',
      async () => {
        const { publisher, read } = await create();
        const payload = { lines: [{ amount: 100 }] };
        const published = await publisher.publish(contextFor(TENANT_A), {
          name: 'invoice.issued',
          version: 1,
          payload,
        });
        payload.lines[0] = { amount: 999 };
        payload.lines.push({ amount: 1 });
        const [event] = await read(TENANT_A);
        check(event !== undefined, 'the event must be stored');
        check(
          sameJson(event.payload, { lines: [{ amount: 100 }] }),
          'the stored payload changed with the caller’s object',
        );
        check(
          published.ok && deepFrozen(published.value),
          'the returned envelope must be deeply frozen',
        );
      },
    ],
    [
      'the envelope carries actor, correlation id, causation and time from the context',
      async () => {
        const { publisher } = await create();
        const context = contextFor(TENANT_A);
        const caused = deriveContext(context, { causationId: EVENT_1 });
        const result = await publisher.publish(caused, {
          name: 'invoice.issued',
          version: 2,
          payload: {},
        });
        check(result.ok, 'publish failed');
        const envelope = result.value;
        check(sameJson(envelope.actor, user1), 'the envelope must carry the actor');
        check(
          envelope.correlationId === context.correlationId,
          'the envelope must carry the correlation id',
        );
        check(envelope.causationId === EVENT_1, 'the envelope must carry the causation id');
        check(
          envelope.occurredAtMillis === FIXTURE_MILLIS,
          'the time must come from the context clock',
        );
        check(envelope.version === 2, 'the version must be kept');
      },
    ],
    [
      'each event gets its own id',
      async () => {
        const { publisher } = await create();
        const ids = new Set<string>();
        for (let i = 0; i < 5; i += 1) {
          const result = await publisher.publish(contextFor(TENANT_A), {
            name: 'invoice.issued',
            version: 1,
            payload: { i },
          });
          check(result.ok, 'publish failed');
          ids.add(result.value.id);
        }
        check(ids.size === 5, 'event ids must be unique');
      },
    ],
    [
      'a payload that is not plain JSON is refused and nothing is published',
      async () => {
        const { publisher, read } = await create();
        const cyclic: Record<string, unknown> = {};
        cyclic['self'] = cyclic;
        for (const payload of [
          undefined,
          { at: new Date(FIXTURE_MILLIS) },
          { n: Number.NaN },
          cyclic,
          () => 1,
        ]) {
          const result = await publisher.publish(contextFor(TENANT_A), {
            name: 'invoice.issued',
            version: 1,
            payload,
          });
          check(
            !result.ok && result.error.code === 'VALIDATION_FAILED',
            'expected VALIDATION_FAILED',
          );
        }
        check((await read(TENANT_A)).length === 0, 'nothing must be published');
      },
    ],
    [
      'an invalid name or version is refused',
      async () => {
        const { publisher } = await create();
        const badName = await publisher.publish(contextFor(TENANT_A), {
          name: 'Issued',
          version: 1,
          payload: {},
        });
        const badVersion = await publisher.publish(contextFor(TENANT_A), {
          name: 'invoice.issued',
          version: 0,
          payload: {},
        });
        check(!badName.ok, 'an invalid name must be refused');
        check(!badVersion.ok, 'version 0 must be refused');
      },
    ],
  ]);
}

// ---------------------------------------------------------------- MessageSender

export interface MessageSenderUnderTest {
  readonly sender: MessageSender;
  readonly read: TenantReader<SentMessage>;
}

const ADDRESS = 'contract.recipient@example.com';
const message: OutboundMessage = {
  channel: 'email',
  to: ADDRESS,
  template: 'invoice_reminder',
  purpose: 'billing',
  consentRef: 'consent-contract-1',
};

/** Every message names a purpose and a consent reference; the send record keeps a masked recipient. */
export function messageSenderContract(
  create: () => MessageSenderUnderTest | Promise<MessageSenderUnderTest>,
): ContractSuite {
  return suite('MessageSender', [
    [
      'a message without a consent reference is refused and not sent',
      async () => {
        const { sender, read } = await create();
        for (const consentRef of ['', '  ', undefined]) {
          const result = await sender.send(contextFor(TENANT_A), {
            ...message,
            consentRef,
          } as OutboundMessage);
          check(
            !result.ok && result.error.code === 'VALIDATION_FAILED',
            'expected VALIDATION_FAILED',
          );
          check(
            result.error.fields.some((f) => f.path === 'consentRef'),
            'the error must name consentRef',
          );
        }
        check((await read(TENANT_A)).length === 0, 'nothing must be sent');
      },
    ],
    [
      'a message without a purpose is refused',
      async () => {
        const { sender } = await create();
        const result = await sender.send(contextFor(TENANT_A), { ...message, purpose: '' });
        check(
          !result.ok && result.error.fields.some((f) => f.path === 'purpose'),
          'the error must name purpose',
        );
      },
    ],
    [
      'an invalid recipient is refused without echoing it',
      async () => {
        const { sender } = await create();
        const result = await sender.send(contextFor(TENANT_A), {
          ...message,
          channel: 'sms',
          to: '98000 01234',
        });
        check(
          !result.ok && result.error.fields.some((f) => f.path === 'to'),
          'the error must name to',
        );
        check(
          !JSON.stringify(result).includes('98000 01234'),
          'the error must not contain the recipient',
        );
      },
    ],
    [
      'the send record keeps the purpose, consent and a masked recipient only',
      async () => {
        const { sender, read } = await create();
        const result = await sender.send(contextFor(TENANT_A), message);
        check(result.ok, 'send failed');
        const stored = await read(TENANT_A);
        check(stored.length === 1, 'the message must be recorded');
        const record = stored[0];
        check(
          record?.purpose === 'billing' && record.consentRef === message.consentRef,
          'purpose and consent must be kept',
        );
        check(record.tenantId === TENANT_A, 'the record must carry the context tenant');
        check(!JSON.stringify(stored).includes(ADDRESS), 'the full recipient must not be stored');
        check(!JSON.stringify(result).includes(ADDRESS), 'the full recipient must not be returned');
      },
    ],
    [
      'messages stay in their tenant',
      async () => {
        const { sender, read } = await create();
        await sender.send(contextFor(TENANT_A), message);
        check((await read(TENANT_B)).length === 0, 'another tenant must see nothing');
      },
    ],
  ]);
}

// ---------------------------------------------------------------- EraserRegistry

const SUBJECT = { subjectId: USER_1 };

const STATUTORY_BASIS = 'CGST Act s.36: keep tax invoices for 72 months';

function handler(
  id: string,
  calls: string[],
  outcome: 'ok' | 'retained' | 'retained-no-basis' | 'err' | 'throw' = 'ok',
): EraserHandler {
  return {
    id,
    erase: (context) => {
      calls.push(`${id}@${context.tenantId}`);
      switch (outcome) {
        case 'throw':
          return Promise.reject(new Error(`${id} crashed`));
        case 'err':
          return Promise.resolve(
            err(coreError('DEPENDENCY_UNAVAILABLE', { detail: `${id} down` })),
          );
        case 'retained':
          return Promise.resolve(ok({ status: 'retained', basis: STATUTORY_BASIS }));
        case 'retained-no-basis':
          return Promise.resolve(ok({ status: 'retained', basis: '' }));
        case 'ok':
          return Promise.resolve(ok({ status: 'erased' }));
      }
    },
  };
}

/** No eraser replaces another, an erase with no erasers is not complete, and every outcome is reported. */
export function eraserRegistryContract(
  create: () => EraserRegistry | Promise<EraserRegistry>,
): ContractSuite {
  return suite('EraserRegistry', [
    [
      'an erase with no handlers is not complete',
      async () => {
        const registry = await create();
        const report = await registry.erase(contextFor(TENANT_A), SUBJECT);
        check(!report.complete, 'no handlers must not count as complete');
        check(report.outcomes.length === 0, 'there must be no outcomes');
      },
    ],
    [
      'a duplicate id is refused and the first handler stays',
      async () => {
        const registry = await create();
        const calls: string[] = [];
        check(
          registry.register(handler('k8-files', calls)).ok,
          'the first registration must succeed',
        );
        const second = registry.register(handler('k8-files', ['replacement']));
        check(!second.ok && second.error.code === 'CONFLICT', 'a duplicate id must be CONFLICT');
        await registry.erase(contextFor(TENANT_A), SUBJECT);
        check(
          sameJson(calls, [`k8-files@${TENANT_A}`]),
          'the first handler must still be the one that runs',
        );
      },
    ],
    [
      'an invalid handler id is refused',
      async () => {
        const registry = await create();
        for (const id of ['', 'K8 Files', '-files']) {
          check(!isEraserHandlerId(id), `fixture id ${id} should be invalid`);
          const result = registry.register(handler(id, []));
          check(
            !result.ok && result.error.code === 'VALIDATION_FAILED',
            `id ${JSON.stringify(id)} must be refused`,
          );
        }
      },
    ],
    [
      'every handler runs in registration order with the caller’s tenant, and all erased is complete',
      async () => {
        const registry = await create();
        const calls: string[] = [];
        registry.register(handler('k2-identity', calls));
        registry.register(handler('k8-files', calls));
        const report = await registry.erase(contextFor(TENANT_A), SUBJECT);
        check(report.complete, 'all handlers erased, so the erase must be complete');
        check(
          sameJson(calls, [`k2-identity@${TENANT_A}`, `k8-files@${TENANT_A}`]),
          'handlers must run in order with the tenant',
        );
        check(
          sameJson(report.outcomes, [
            { handlerId: 'k2-identity', status: 'erased' },
            { handlerId: 'k8-files', status: 'erased' },
          ]),
          `unexpected outcomes ${JSON.stringify(report.outcomes)}`,
        );
      },
    ],
    [
      'data kept under a legal basis is reported with the basis and still counts as complete',
      async () => {
        const registry = await create();
        registry.register(handler('k2-identity', []));
        registry.register(handler('epc-invoicing', [], 'retained'));
        const report = await registry.erase(contextFor(TENANT_A), SUBJECT);
        check(report.complete, 'erased plus retained-with-basis must be complete');
        check(
          sameJson(report.outcomes[1], {
            handlerId: 'epc-invoicing',
            status: 'retained',
            basis: STATUTORY_BASIS,
          }),
          `the retention and its basis must be reported, got ${JSON.stringify(report.outcomes[1])}`,
        );
      },
    ],
    [
      'a retention without a basis is a failure, never silent',
      async () => {
        const registry = await create();
        registry.register(handler('epc-invoicing', [], 'retained-no-basis'));
        const report = await registry.erase(contextFor(TENANT_A), SUBJECT);
        check(!report.complete, 'a retention without a basis must not count as complete');
        check(report.outcomes[0]?.status === 'failed', 'it must be reported as failed');
      },
    ],
    [
      'erasing twice runs every handler again and is still complete',
      async () => {
        const registry = await create();
        const calls: string[] = [];
        registry.register(handler('k2-identity', calls));
        const first = await registry.erase(contextFor(TENANT_A), SUBJECT);
        const second = await registry.erase(contextFor(TENANT_A), SUBJECT);
        check(first.complete && second.complete, 'both runs must be complete');
        check(calls.length === 2, 'a retry must run the handler again');
      },
    ],
    [
      'a failing or throwing handler is reported, the others still run, and the erase is not complete',
      async () => {
        const registry = await create();
        const calls: string[] = [];
        registry.register(handler('k2-identity', calls, 'err'));
        registry.register(handler('k7a-audit', calls, 'throw'));
        registry.register(handler('k8-files', calls));
        const report = await registry.erase(contextFor(TENANT_A), SUBJECT);
        check(!report.complete, 'a failed handler must make the erase incomplete');
        check(calls.length === 3, 'every handler must run even after a failure');
        const statuses = report.outcomes.map((o) => `${o.handlerId}:${o.status}`);
        check(
          sameJson(statuses, ['k2-identity:failed', 'k7a-audit:failed', 'k8-files:erased']),
          `unexpected outcomes ${JSON.stringify(statuses)}`,
        );
        const thrown = report.outcomes[1];
        check(
          thrown?.status === 'failed' && thrown.error.code === 'INTERNAL',
          'a throw must be reported as INTERNAL',
        );
      },
    ],
  ]);
}
