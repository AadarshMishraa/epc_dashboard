/**
 * Public API of @gx/core. This is the only file other packages may import.
 * Core has no I/O and no dependencies: time and randomness are passed in.
 * The core ports are interfaces only; their in-memory fakes and contract suites are in
 * @gx/testkit (K0-T14). Logging (K0-T04) is next.
 */
import { moduleId, type ModuleId } from './module-id.ts';

export { MODULE_ID_MAX_LENGTH, isModuleId, moduleId, type ModuleId } from './module-id.ts';
export { err, ok, type Err, type Ok, type Result } from './result.ts';
export {
  CORE_ERRORS,
  ERROR_STATUSES,
  appError,
  coreError,
  defineErrorCatalogue,
  toErrorResponse,
  type AppError,
  type AppErrorOptions,
  type CoreErrorCode,
  type ErrorDefinition,
  type ErrorResponseBody,
  type ErrorStatus,
  type FieldError,
} from './errors.ts';
export { nowDate, systemClock, type Clock } from './clock.ts';
export {
  createIdGenerator,
  idTimestamp,
  isId,
  parseId,
  webCryptoRandomBytes,
  type Id,
  type IdGenerator,
  type IdGeneratorOptions,
  type RandomBytes,
} from './ids.ts';
export {
  correlationIdFromId,
  createContext,
  deriveContext,
  parseAiClientId,
  parseCorrelationId,
  parseTenantId,
  requireTenant,
  type Actor,
  type AiClient,
  type AiClientId,
  type AiClientScope,
  type Context,
  type ContextInput,
  type CorrelationId,
  type TenantContext,
  type TenantId,
} from './context.ts';

export { Secret } from './secret.ts';
export {
  ALLOW,
  actorCeiling,
  authorize,
  deny,
  isAllowed,
  type Authorizer,
  type Decision,
  type DenyReason,
  type PermissionMode,
  type ResourceRef,
} from './ports/authorizer.ts';
export {
  checkEntitlement,
  type EntitlementDecision,
  type EntitlementGate,
} from './ports/entitlements.ts';
export { isValidQuotaAmount, type QuotaDecision, type QuotaProvider } from './ports/quota.ts';
export {
  DATA_CLASSES,
  atLeast,
  type ClassificationLookup,
  type DataClass,
} from './ports/classification.ts';
export type { SecretsProvider } from './ports/secrets.ts';
export type { AuditEntry, AuditRecord, AuditSink } from './ports/audit.ts';
export type { EventEnvelope, EventInput, EventPublisher, JsonValue } from './ports/events.ts';
export {
  maskAddress,
  validateOutgoing,
  type MessageChannel,
  type MessageSender,
  type OutgoingMessage,
} from './ports/messages.ts';
export type {
  DataSubject,
  EraseOutcome,
  EraserHandler,
  EraserRegistry,
  HandlerOutcome,
  SubjectReport,
} from './ports/erasure.ts';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('core');
