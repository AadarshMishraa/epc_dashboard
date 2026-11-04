import type { Actor, CorrelationId, TenantContext, TenantId } from '../context.ts';
import type { AppError } from '../errors.ts';
import type { Id } from '../ids.ts';
import type { Result } from '../result.ts';
import type { ResourceRef } from './authorizer.ts';

export interface AuditEntry {
  /** `entity.action`, for example `invoice.issue`. */
  readonly action: string;
  readonly resource: ResourceRef;
  readonly outcome: 'success' | 'denied' | 'failure';
  /** Masked before it gets here (K7a): field names to their old and new masked values. */
  readonly changes?: Readonly<
    Record<string, { readonly from: string | null; readonly to: string | null }>
  >;
}

/** What the sink stores: the entry plus who, where and when, all from the context. */
export interface AuditRecord extends AuditEntry {
  readonly id: Id;
  readonly tenantId: TenantId;
  readonly actor: Actor;
  readonly initiatedBy?: Actor;
  readonly correlationId: CorrelationId;
  readonly at: number;
}

/**
 * Append-only audit trail (K7a implements it with a hash chain, in the same transaction
 * as the change). `append` resolves only after the record is stored; a failure is
 * returned, so critical actions can fail closed.
 */
export interface AuditSink {
  append(context: TenantContext, entry: AuditEntry): Promise<Result<{ readonly id: Id }, AppError>>;
}
