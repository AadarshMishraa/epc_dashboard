/**
 * Public API of @gx/testkit. This is the only file other packages may import.
 * A test-only package: depend on it from devDependencies, never from runtime code.
 * Capabilities arrive with the K0 tasks in docs/plans/001-foundation/K0-core.md.
 */
import { moduleId, type ModuleId } from '@gx/core';

export {
  CONTRACT_TENANTS,
  CONTRACT_USERS,
  ContractViolation,
  type AdapterFactory,
  type ContractCase,
  type ContractSuite,
  type TenantReader,
} from './contract.ts';
export {
  authorizerContract,
  classificationLookupContract,
  entitlementGateContract,
  quotaProviderContract,
  type AuthorizerSeed,
  type ClassificationSeed,
  type EntitlementSeed,
  type QuotaSeed,
} from './contracts/policy.ts';
export {
  auditSinkContract,
  eraserRegistryContract,
  eventPublisherContract,
  messageSenderContract,
  secretsProviderContract,
  type AuditSinkUnderTest,
  type EventPublisherUnderTest,
  type MessageSenderUnderTest,
  type SecretsSeed,
  type SecretsUnderTest,
} from './contracts/records.ts';
export {
  FakeAuthorizer,
  FakeClassificationLookup,
  FakeEntitlementGate,
  FakeQuotaProvider,
} from './fakes/policy.ts';
export {
  FakeAuditSink,
  FakeEraserRegistry,
  FakeEventPublisher,
  FakeMessageSender,
  FakePlatformSecretsProvider,
  FakeTenantSecretsProvider,
  type RecordingFakeOptions,
} from './fakes/records.ts';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('testkit');
