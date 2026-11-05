/**
 * Public API of @gx/core. This is the only file other packages may import.
 * Core has no I/O and no dependencies: time and randomness are passed in.
 * The ports' in-memory fakes and contract suites live in @gx/testkit. Logging (K0-T04) is next.
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
export {
  ALLOW,
  deny,
  isAllowed,
  type Allow,
  type Decision,
  type Deny,
  type DenyOnError,
} from './ports/decision.ts';
export {
  AUTHORIZATION_DENIALS,
  actorModeDenial,
  authorize,
  type AuthorizationDecision,
  type AuthorizationDenial,
  type AuthorizationRequest,
  type Authorizer,
  type PermissionMode,
  type ResourceRef,
} from './ports/authorizer.ts';
export {
  ENTITLEMENT_DENIALS,
  checkEntitlement,
  type EntitlementDecision,
  type EntitlementDenial,
  type EntitlementGate,
} from './ports/entitlements.ts';
export {
  QUOTA_DENIALS,
  consumeQuota,
  isIdempotencyKey,
  isQuotaAmount,
  type QuotaDecision,
  type QuotaDenial,
  type QuotaGrant,
  type QuotaProvider,
  type QuotaUse,
} from './ports/quotas.ts';
export {
  CLASSIFICATIONS,
  classifyField,
  isClassification,
  type Classification,
  type ClassificationLookup,
  type FieldRef,
} from './ports/classification.ts';
export { Secret } from './ports/secret.ts';
export type {
  PlatformSecretsProvider,
  SecretError,
  TenantSecretsProvider,
} from './ports/secrets.ts';
export { toFrozenJson, type JsonValue } from './ports/json.ts';
export {
  createEventEnvelope,
  prepareEvent,
  type EventEnvelope,
  type EventInput,
  type EventPublisher,
  type PreparedEvent,
} from './ports/events.ts';
export {
  AUDIT_OUTCOMES,
  createAuditRecord,
  prepareAuditEntry,
  type AuditEntry,
  type AuditOutcome,
  type AuditRecord,
  type AuditSink,
  type PreparedAuditEntry,
} from './ports/audit.ts';
export {
  MESSAGE_CHANNELS,
  maskRecipient,
  prepareMessage,
  type MessageChannel,
  type MessageSender,
  type OutboundMessage,
  type PreparedMessage,
  type SentMessage,
} from './ports/messages.ts';
export {
  isEraserHandlerId,
  isErasureComplete,
  runEraser,
  type EraserHandler,
  type EraserRegistry,
  type ErasureOutcome,
  type ErasureReport,
  type ErasureResult,
  type ErasureSubject,
} from './ports/erasure.ts';

export {
  LOG_LEVELS,
  createLogger,
  type LogCallOptions,
  type LogFields,
  type LogLevel,
  type LogSink,
  type Logger,
  type LoggerOptions,
} from './logging/logger.ts';
export {
  LIMITS as REDACTION_LIMITS,
  isSecretKey,
  redactString,
  redactValue,
  summariseError,
} from './logging/redact.ts';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('core');
