import type { TenantContext } from '../context.ts';
import { coreError, type AppError } from '../errors.ts';
import type { Id } from '../ids.ts';
import type { Result } from '../result.ts';
import { isNonBlankString } from './names.ts';

/** The person whose data is erased (a data principal under the DPDP Act). */
export interface ErasureSubject {
  readonly subjectId: Id;
}

/**
 * What a handler did. `retained` is for data a law requires keeping (for example GST
 * invoices); `basis` names that law or rule, so the retention is recorded, never silent.
 */
export type ErasureResult =
  { readonly status: 'erased' } | { readonly status: 'retained'; readonly basis: string };

/**
 * One module's eraser. Each module that stores personal data registers one (K7b, K8).
 * Handlers must be idempotent: a retry runs every handler again, including ones that
 * already erased.
 */
export interface EraserHandler {
  /** Unique across the registry: the module id, optionally `.part`, for example `k8-files.blobs`. */
  readonly id: string;
  erase(context: TenantContext, subject: ErasureSubject): Promise<Result<ErasureResult, AppError>>;
}

export type ErasureOutcome =
  | { readonly handlerId: string; readonly status: 'erased' }
  | { readonly handlerId: string; readonly status: 'retained'; readonly basis: string }
  | { readonly handlerId: string; readonly status: 'failed'; readonly error: AppError };

export interface ErasureReport {
  /** True only when at least one handler ran and every handler erased or retained with a basis. */
  readonly complete: boolean;
  /** One outcome per registered handler, in registration order. */
  readonly outcomes: readonly ErasureOutcome[];
}

/**
 * Collects erasers and runs all of them for a subject. Registering an id twice is refused,
 * so no module's eraser replaces another's; an erase with no handlers is not complete; a
 * failing or throwing handler is reported and the others still run. Implemented by K7b,
 * which runs each handler through `runEraser` and judges the report with `isErasureComplete`.
 */
export interface EraserRegistry {
  register(handler: EraserHandler): Result<void, AppError<'CONFLICT' | 'VALIDATION_FAILED'>>;
  erase(context: TenantContext, subject: ErasureSubject): Promise<ErasureReport>;
}

const HANDLER_ID = /^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/;
const HANDLER_ID_MAX_LENGTH = 128;

export function isEraserHandlerId(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length <= HANDLER_ID_MAX_LENGTH && HANDLER_ID.test(value)
  );
}

/**
 * Runs one handler and never throws: a throw, a malformed answer or a retention without a
 * basis is a `failed` outcome, so one bad eraser cannot stop the others or the report.
 */
export async function runEraser(
  handlerId: string,
  erase: EraserHandler['erase'],
  context: TenantContext,
  subject: ErasureSubject,
): Promise<ErasureOutcome> {
  const failed = (error: AppError): ErasureOutcome =>
    Object.freeze({ handlerId, status: 'failed', error });
  try {
    const result: unknown = await erase(context, subject);
    const settled = result as Partial<{ ok: unknown; value: unknown; error: unknown }> | null;
    if (settled?.ok === false && isAppError(settled.error)) return failed(settled.error);
    if (settled?.ok === true) {
      const value = settled.value as Partial<{ status: unknown; basis: unknown }> | null;
      if (value?.status === 'erased') return Object.freeze({ handlerId, status: 'erased' });
      if (value?.status === 'retained' && isNonBlankString(value.basis)) {
        return Object.freeze({ handlerId, status: 'retained', basis: value.basis });
      }
    }
    return failed(
      coreError('INTERNAL', { detail: `eraser ${handlerId} returned no valid result` }),
    );
  } catch (cause) {
    return failed(coreError('INTERNAL', { detail: `eraser ${handlerId} threw`, cause }));
  }
}

export function isErasureComplete(outcomes: readonly ErasureOutcome[]): boolean {
  return outcomes.length > 0 && outcomes.every((outcome) => outcome.status !== 'failed');
}

function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string'
  );
}
