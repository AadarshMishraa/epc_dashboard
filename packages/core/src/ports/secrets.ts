import type { TenantContext } from '../context.ts';
import type { AppError } from '../errors.ts';
import type { Result } from '../result.ts';
import type { Secret } from '../secret.ts';

/**
 * The only way to read a secret (security guidelines 4.9). A missing secret and another
 * tenant's secret give the same NOT_FOUND, so the answer reveals nothing.
 */
export interface SecretsProvider {
  /** A secret of the platform itself, for example the password pepper. */
  platform(name: string): Promise<Result<Secret, AppError<'NOT_FOUND'>>>;
  /** A secret that belongs to one tenant, for example its WhatsApp provider key. */
  forTenant(context: TenantContext, name: string): Promise<Result<Secret, AppError<'NOT_FOUND'>>>;
}
