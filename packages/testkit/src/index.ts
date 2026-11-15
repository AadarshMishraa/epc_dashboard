/**
 * Public API of @gx/testkit. This is the only file other packages may import.
 * A test-only package: depend on it from devDependencies, never from runtime code.
 */
import { moduleId, type ModuleId } from '@gx/core';

export { FrozenClock } from './clock.ts';
export {
  assertIsolation,
  IsolationFailure,
  type IsolationReport,
  type IsolationViolation,
  type SqlExecutor,
  type SqlResult,
} from './isolation.ts';
export {
  checkPoolLeak,
  type PoolLeakOptions,
  type PoolLeakReport,
  type PoolLeakTarget,
} from './pool-leak.ts';
export {
  runTenantMatrix,
  type SeedContext,
  type TableSeed,
  type TenantMatrixOptions,
  type TenantMatrixReport,
} from './tenant-matrix.ts';
export {
  CONTRACT_TENANTS,
  contextFor,
  contextWithoutTenant,
  FIXTURE_MILLIS,
  TENANT_A,
  TENANT_B,
  USER_1,
  USER_2,
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
