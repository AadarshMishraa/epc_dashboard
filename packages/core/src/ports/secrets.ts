import type { TenantContext } from '../context.ts';
import type { AppError } from '../errors.ts';
import type { Result } from '../result.ts';
import type { Secret } from './secret.ts';

export type SecretError = AppError<'NOT_FOUND' | 'DEPENDENCY_UNAVAILABLE'>;

/**
 * Reads a tenant's own secrets (an SMTP password, a payment gateway key). Keyed by tenant and
 * name: another tenant's secret is `NOT_FOUND`, the same answer as a missing one. The only way
 * module code reads a tenant secret (security guidelines 1.7).
 */
export interface TenantSecretsProvider {
  get(context: TenantContext, name: string): Promise<Result<Secret, SecretError>>;
}

/**
 * Reads platform secrets (signing keys, provider credentials). A separate port, wired only
 * into the few packages that need it, so holding tenant secret access never reaches these.
 */
export interface PlatformSecretsProvider {
  get(name: string): Promise<Result<Secret, SecretError>>;
}
