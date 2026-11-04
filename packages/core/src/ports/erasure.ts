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
  readonly outcomes: readonly HandlerOutcome<T>[];
}

/**
 * Why an erasure or export is not complete. `NO_HANDLERS` means nothing was registered;
 * `INCOMPLETE` means at least one handler failed, timed out or answered badly, and the
 * report shows which. A caller must not close a data request on either.
 */
export interface IncompleteSubjectReport<T> extends SubjectReport<T> {
  readonly code: 'NO_HANDLERS' | 'INCOMPLETE';
}

/**
 * Every module that stores personal data registers a handler here, so K7b's request desk
 * can erase and export a person without importing the modules. A second handler for the
 * same module and entity is rejected. Handlers run concurrently, each with a deadline, so
 * one that hangs cannot block the rest; only a complete run is `ok`. Because they run
 * concurrently, a handler must not rely on another module's handler running first.
 */
export interface EraserRegistry {
  register(handler: EraserHandler): Result<undefined, AppError<'CONFLICT'>>;
  erase(
    context: TenantContext,
    subject: DataSubject,
  ): Promise<Result<SubjectReport<EraseOutcome>, IncompleteSubjectReport<EraseOutcome>>>;
  export(
    context: TenantContext,
    subject: DataSubject,
  ): Promise<
    Result<SubjectReport<readonly JsonValue[]>, IncompleteSubjectReport<readonly JsonValue[]>>
  >;
}
