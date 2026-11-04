import type { TenantContext } from '../context.ts';
import type { AppError } from '../errors.ts';
import type { Id } from '../ids.ts';
import type { Result } from '../result.ts';
import type { JsonValue } from './events.ts';

/** The person a data request is about. */
export interface DataSubject {
  readonly kind: 'person';
  readonly id: Id;
}

export interface EraseOutcome {
  readonly erased: number;
  /** Records kept because a law requires it (for example tax records), with the reason. */
  readonly retained: number;
  readonly retainedReason?: string;
}

/** One module's share of erasure and export for the entities it owns. */
export interface EraserHandler {
  readonly module: string;
  readonly entity: string;
  erase(context: TenantContext, subject: DataSubject): Promise<Result<EraseOutcome, AppError>>;
  export(
    context: TenantContext,
    subject: DataSubject,
  ): Promise<Result<readonly JsonValue[], AppError>>;
}

export interface HandlerOutcome<T> {
  readonly module: string;
  readonly entity: string;
  readonly result: Result<T, AppError>;
}

export interface SubjectReport<T> {
  /** True only when every handler succeeded. */
  readonly complete: boolean;
  readonly outcomes: readonly HandlerOutcome<T>[];
}

/**
 * Every module that stores personal data registers a handler here, so K7b's request desk
 * can erase and export a person without importing the modules. A second handler for the
 * same module and entity is rejected; erasing with no handlers is a failure, not a success.
 */
export interface EraserRegistry {
  register(handler: EraserHandler): Result<undefined, AppError<'CONFLICT'>>;
  erase(
    context: TenantContext,
    subject: DataSubject,
  ): Promise<Result<SubjectReport<EraseOutcome>, AppError<'UNPROCESSABLE'>>>;
  export(
    context: TenantContext,
    subject: DataSubject,
  ): Promise<Result<SubjectReport<readonly JsonValue[]>, AppError<'UNPROCESSABLE'>>>;
}
