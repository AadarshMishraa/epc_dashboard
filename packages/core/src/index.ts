/**
 * Public API of @gx/core. This is the only file other packages may import.
 * Core has no I/O and no dependencies: time and randomness are passed in.
 * Ports with in-memory fakes (K0-T14) and logging (K0-T04) join these types.
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

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('core');
