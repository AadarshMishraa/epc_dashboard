import type { TenantId } from '@gx/core';
import { CONTRACT_TENANTS } from './contract.ts';
import {
  DEFAULT_TENANT_SETTING,
  describeError,
  requireTenantSetting,
  type IsolationReport,
  type IsolationViolation,
  type SqlExecutor,
} from './isolation.ts';

/**
 * The application's tenant-scoped database entry point, as a test sees it. Both methods must run
 * `work` on a pooled connection; `runAs` must set the tenant the way production code does
 * (transaction-local, ADR-0002) and must reject when `work` throws.
 */
export interface PoolLeakTarget {
  runAs(tenantId: TenantId, work: (sql: SqlExecutor) => Promise<void>): Promise<void>;
  /**
   * Must be a raw checkout of a pooled connection: no `RESET`, no `DISCARD`, no tenant handling.
   * A wrapper that cleans the session would hide the very leak this check looks for.
   */
  runWithoutTenant(work: (sql: SqlExecutor) => Promise<void>): Promise<void>;
}

export interface PoolLeakOptions {
  /** Two different tenants. Default `CONTRACT_TENANTS`. */
  readonly tenants?: readonly [TenantId, TenantId];
  /** Postgres setting that carries the tenant. Default `app.tenant_id`. */
  readonly tenantSetting?: string;
  /** How many alternating and concurrent rounds to run. Default 25. */
  readonly rounds?: number;
}

export interface PoolLeakReport extends IsolationReport {
  /** Backend connections that served both a tenant call and a no-tenant call. 0 means inconclusive. */
  readonly sharedConnections: number;
}

class WorkFailed extends Error {
  override readonly name = 'WorkFailed';
}

/**
 * Proves tenant context does not outlive its transaction on a reused connection.
 *
 * Alternating tenant and no-tenant calls, a tenant call whose work throws, and many concurrent
 * calls for both tenants: every read of the setting must show the caller's own tenant, or nothing.
 * Configure the pool with one connection so reuse is certain; the check fails as inconclusive
 * when no connection served both kinds of call, so a pool that never reuses cannot pass it.
 */
export async function checkPoolLeak(
  target: PoolLeakTarget,
  options: PoolLeakOptions = {},
): Promise<PoolLeakReport> {
  const [tenantA, tenantB] =
    options.tenants ?? ([CONTRACT_TENANTS[0], CONTRACT_TENANTS[1]] as const);
  if (tenantA === undefined || tenantB === undefined || tenantA === tenantB) {
    throw new RangeError('The pool-leak check needs two different tenants');
  }
  const setting = requireTenantSetting(options.tenantSetting ?? DEFAULT_TENANT_SETTING);
  const rounds = options.rounds ?? 25;
  if (!Number.isInteger(rounds) || rounds < 1)
    throw new RangeError('rounds must be a positive integer');

  const violations: IsolationViolation[] = [];
  const violate = (check: string, detail: string): void => {
    violations.push({ subject: 'pool', check, detail });
  };
  const withTenantPids = new Set<string>();
  const withoutTenantPids = new Set<string>();

  const readSetting = async (
    sql: SqlExecutor,
  ): Promise<{ pid: string; tenant: string; session: string }> => {
    const row = (
      await sql.query(
        `SELECT pg_backend_pid()::text AS pid, current_setting($1, true) AS tenant,
                current_user::text AS usr, current_setting('role') AS role_setting,
                current_setting('search_path') AS path`,
        [setting],
      )
    ).rows[0];
    const text = (value: unknown): string => (typeof value === 'string' ? value : '');
    return {
      pid: typeof row?.['pid'] === 'string' ? row['pid'] : 'unknown',
      tenant: text(row?.['tenant']),
      // Other session state a careless wrapper can leave behind between checkouts.
      session: [text(row?.['usr']), text(row?.['role_setting']), text(row?.['path'])].join('|'),
    };
  };

  const expectOwn = async (tenantId: TenantId, phase: string): Promise<void> => {
    await target.runAs(tenantId, async (sql) => {
      const seen = await readSetting(sql);
      withTenantPids.add(seen.pid);
      if (seen.tenant !== tenantId) {
        violate(
          'own-tenant',
          `${phase}: a call for one tenant saw ${seen.tenant === '' ? 'no tenant' : 'another tenant'}`,
        );
      }
    });
  };

  // The first no-tenant checkout, before any tenant call, sets what "clean" looks like.
  let baselineSession: string | undefined;
  const expectNone = async (phase: string): Promise<void> => {
    await target.runWithoutTenant(async (sql) => {
      const seen = await readSetting(sql);
      withoutTenantPids.add(seen.pid);
      if (seen.tenant !== '') {
        violate('leak', `${phase}: a call with no tenant still saw a tenant id`);
      }
      baselineSession ??= seen.session;
      if (seen.session !== baselineSession) {
        violate(
          'session-state',
          `${phase}: user, role or search_path differs from the clean baseline (${seen.session} vs ${baselineSession})`,
        );
      }
    });
  };

  try {
    await expectNone('baseline');
    for (let round = 0; round < rounds; round += 1) {
      await expectOwn(round % 2 === 0 ? tenantA : tenantB, 'alternating');
      await expectNone('after a tenant call');
    }

    // The work throws: the target must reject, and the connection must come back clean.
    let rejected = false;
    try {
      await target.runAs(tenantA, async (sql) => {
        const seen = await readSetting(sql);
        withTenantPids.add(seen.pid);
        throw new WorkFailed('deliberate failure inside tenant work');
      });
    } catch (error) {
      rejected = error instanceof WorkFailed;
      if (!rejected)
        violate('failure', `runAs rejected with a different error: ${describeError(error)}`);
    }
    if (!rejected && violations.every((v) => v.check !== 'failure')) {
      violate('failure', 'runAs resolved although the work threw: the error was swallowed');
    }
    await expectNone('after a failed tenant call');

    // Concurrent callers for both tenants must never see each other's id.
    await Promise.all(
      Array.from({ length: rounds * 2 }, (_, i) =>
        expectOwn(i % 2 === 0 ? tenantA : tenantB, 'concurrent'),
      ),
    );
    await expectNone('after concurrent calls');
  } catch (error) {
    violate('run', `the check could not finish: ${describeError(error)}`);
  }

  const sharedConnections = [...withTenantPids].filter((pid) => withoutTenantPids.has(pid)).length;
  if (sharedConnections === 0 && violations.length === 0) {
    violate(
      'reuse',
      'no connection served both a tenant and a no-tenant call: set the pool size to 1',
    );
  }

  return Object.freeze({ sharedConnections, violations: Object.freeze(violations) });
}
