import {
  freezeActor,
  type Actor,
  type CorrelationId,
  type TenantContext,
  type TenantId,
} from '../context.ts';
import { coreError, type AppError, type FieldError } from '../errors.ts';
import { isId, type Id } from '../ids.ts';
import { err, ok, type Result } from '../result.ts';
import type { ResourceRef } from './authorizer.ts';
import { isDottedName, isSnakeName } from './names.ts';

export const AUDIT_OUTCOMES = Object.freeze(['succeeded', 'denied', 'failed'] as const);
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

export interface AuditEntry {
  /** The permission-style action, `entity.action`, for example `invoice.issue`. */
  readonly action: string;
  readonly outcome: AuditOutcome;
  readonly target?: ResourceRef;
}

declare const preparedAuditEntryBrand: unique symbol;

/** An entry that passed `prepareAuditEntry`; only that function produces one. */
export type PreparedAuditEntry = AuditEntry & { readonly [preparedAuditEntryBrand]: true };

/** Frozen once written. Tenant, actor and correlation id always come from the context. */
export interface AuditRecord {
  readonly id: Id;
  readonly tenantId: TenantId;
  readonly actor: Actor;
  readonly initiatedBy?: Actor;
  readonly correlationId: CorrelationId;
  readonly causationId?: Id;
  readonly occurredAtMillis: number;
  readonly action: string;
  readonly outcome: AuditOutcome;
  readonly target?: ResourceRef;
}

/**
 * Appends to the tenant's audit trail. Returns only after the record is written; a failure
 * is returned, never swallowed, so the caller can fail the action it was auditing.
 * Implemented by K7a in the caller's transaction.
 */
export interface AuditSink {
  append(context: TenantContext, entry: AuditEntry): Promise<Result<AuditRecord, AppError>>;
}

export function prepareAuditEntry(
  entry: AuditEntry,
): Result<PreparedAuditEntry, AppError<'VALIDATION_FAILED'>> {
  const fields: FieldError[] = [];
  if (!isDottedName(entry.action)) fields.push({ path: 'action', code: 'invalid_name' });
  if (!(AUDIT_OUTCOMES as readonly unknown[]).includes(entry.outcome)) {
    fields.push({ path: 'outcome', code: 'invalid_outcome' });
  }
  const target: unknown = entry.target;
  if (target !== undefined) {
    if (typeof target !== 'object' || target === null) {
      fields.push({ path: 'target', code: 'invalid_target' });
    } else {
      const { type, id } = target as { type?: unknown; id?: unknown };
      if (!isSnakeName(type)) fields.push({ path: 'target.type', code: 'invalid_name' });
      if (!isId(id)) fields.push({ path: 'target.id', code: 'invalid_id' });
    }
  }
  if (fields.length > 0) {
    return err(coreError('VALIDATION_FAILED', { fields, detail: 'invalid audit entry' }));
  }
  return ok(
    Object.freeze({
      action: entry.action,
      outcome: entry.outcome,
      ...(entry.target === undefined
        ? {}
        : { target: Object.freeze({ type: entry.target.type, id: entry.target.id }) }),
    }) as PreparedAuditEntry,
  );
}

export function createAuditRecord(
  context: TenantContext,
  entry: PreparedAuditEntry,
  id: Id,
): AuditRecord {
  return Object.freeze({
    id,
    tenantId: context.tenantId,
    actor: freezeActor(context.actor),
    ...(context.initiatedBy === undefined ? {} : { initiatedBy: freezeActor(context.initiatedBy) }),
    correlationId: context.correlationId,
    ...(context.causationId === undefined ? {} : { causationId: context.causationId }),
    occurredAtMillis: context.clock.nowMillis(),
    action: entry.action,
    outcome: entry.outcome,
    ...(entry.target === undefined ? {} : { target: entry.target }),
  });
}
