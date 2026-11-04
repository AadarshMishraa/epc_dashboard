/**
 * Public API of @gx/testkit. Test-only: packages list it in devDependencies, and the
 * import-graph check rejects it in runtime code, so a fake can never ship to production.
 */
import { moduleId, type ModuleId } from '@gx/core';

export { frozenClock, type FrozenClock } from './clock.ts';
export {
  TEST_CORRELATION,
  tenantContext,
  testId,
  testTenant,
  type TenantContextOptions,
} from './context.ts';
export {
  fakeAuthorizer,
  fakeClassificationLookup,
  fakeEntitlementGate,
  fakeQuotaProvider,
  subjectOf,
  type AuthorizerSeed,
  type ClassificationSeed,
  type EntitlementSeed,
  type QuotaSeed,
} from './fakes/access.ts';
export {
  fakeAuditSink,
  fakeEventPublisher,
  fakeMessageSender,
  type FailureInjection,
  type FakeAuditSink,
  type FakeEventPublisher,
  type FakeMessageSender,
  type SentMessage,
} from './fakes/records.ts';
export { fakeSecretsProvider, type SecretsSeed } from './fakes/secrets.ts';
export { inMemoryEraserRegistry } from './fakes/erasure.ts';
export {
  authorizerContract,
  classificationLookupContract,
  entitlementGateContract,
  quotaProviderContract,
  secretsProviderContract,
  type ContractFactory,
} from './contracts/access.ts';
export {
  auditSinkContract,
  eraserRegistryContract,
  eventPublisherContract,
  messageSenderContract,
  type AuditHarness,
  type EventHarness,
  type MessageHarness,
} from './contracts/records.ts';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('testkit');
