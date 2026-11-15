/**
 * Shared pieces of the database isolation helpers (tenant matrix, pool-leak check).
 *
 * The helpers take a minimal `SqlExecutor` instead of a driver, so testkit has no runtime
 * dependency on `pg`. A `pg` `Client` or a checked-out `PoolClient` satisfies it as is.
 */

export interface SqlResult {
  readonly rows: readonly Record<string, unknown>[];
  readonly rowCount: number | null;
}

export interface SqlExecutor {
  query(text: string, values?: readonly unknown[]): Promise<SqlResult>;
}

/** One way isolation failed. `detail` never holds row values: fixtures are synthetic anyway. */
export interface IsolationViolation {
  /** A `schema.table`, or `pool` or `connection` for checks that are not about one table. */
  readonly subject: string;
  /** A stable id for the check, for example `rls-forced` or `delete`. */
  readonly check: string;
  readonly detail: string;
}

export interface IsolationReport {
  readonly violations: readonly IsolationViolation[];
}

export class IsolationFailure extends Error {
  override readonly name = 'IsolationFailure';
  readonly violations: readonly IsolationViolation[];

  constructor(violations: readonly IsolationViolation[]) {
    super(
      `${String(violations.length)} isolation violation(s):\n` +
        violations.map((v) => `  [${v.check}] ${v.subject}: ${v.detail}`).join('\n'),
    );
    this.violations = violations;
  }
}

/** Throws `IsolationFailure` listing every violation, or returns when there are none. */
export function assertIsolation(report: IsolationReport): void {
  if (report.violations.length > 0) throw new IsolationFailure(report.violations);
}

/** The Postgres setting the tenant is set in, per ADR-0002. */
export const DEFAULT_TENANT_SETTING = 'app.tenant_id';

const SETTING_PATTERN = /^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/;

export function requireTenantSetting(name: string): string {
  if (!SETTING_PATTERN.test(name)) {
    throw new RangeError('tenantSetting must look like `namespace.name` in lower case');
  }
  return name;
}

/** The SQLSTATE of a driver error, or `undefined` when the value is not one. */
export function sqlState(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/** `insufficient_privilege`: Postgres uses it for a denied grant and for a row-level security block. */
export const BLOCKED_STATE = '42501';

export function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export function describeError(error: unknown): string {
  const state = sqlState(error);
  const message = error instanceof Error ? error.message : 'non-Error value thrown';
  return state === undefined ? message : `${message} (SQLSTATE ${state})`;
}
