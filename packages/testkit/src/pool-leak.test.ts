import { describe, expect, it } from 'vitest';
import {
  IsolationFailure,
  assertIsolation,
  checkPoolLeak,
  runTenantMatrix,
  TENANT_A,
  type PoolLeakTarget,
  type SqlExecutor,
} from './index.ts';

/**
 * A pretend single-connection pool. `leak` makes it keep the tenant after the call (what a
 * session-level SET does); `swallow` makes `runAs` hide an error; `fresh` gives every call its
 * own backend, so no connection is ever reused.
 */
function fakePool(
  mode: {
    leak?: boolean;
    swallow?: boolean;
    fresh?: boolean;
    sessionLeak?: boolean;
    noSet?: boolean;
  } = {},
): PoolLeakTarget {
  let setting = '';
  let path = 'public';
  let backends = 0;
  const connection = (pid: string): SqlExecutor => ({
    query: (text: string) => {
      expect(text).toContain('current_setting');
      return Promise.resolve({
        rows: [{ pid, tenant: setting, usr: 'app', role_setting: 'none', path }],
        rowCount: 1,
      });
    },
  });
  // One connection serves one call at a time, like a pool of size 1.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const result = queue.then(run);
    queue = result.catch(() => undefined);
    return result;
  };
  const nextPid = (): string => (mode.fresh === true ? `pid-${String((backends += 1))}` : 'pid-1');
  return {
    runAs: (tenantId, work) =>
      serial(async () => {
        if (mode.noSet !== true) setting = tenantId;
        if (mode.sessionLeak === true) path = 'tenant_schema, public';
        try {
          await work(connection(nextPid()));
        } catch (error) {
          if (mode.swallow !== true) throw error;
        } finally {
          if (mode.leak !== true) setting = '';
        }
      }),
    runWithoutTenant: (work) => serial(() => work(connection(nextPid()))),
  };
}

describe('checkPoolLeak', () => {
  it('passes a pool that clears the tenant and reuses its connection', async () => {
    const report = await checkPoolLeak(fakePool());
    expect(report.violations).toEqual([]);
    expect(report.sharedConnections).toBe(1);
    assertIsolation(report);
  });

  it('catches a tenant that survives its transaction', async () => {
    const report = await checkPoolLeak(fakePool({ leak: true }));
    expect(report.violations.some((v) => v.check === 'leak')).toBe(true);
    expect(() => {
      assertIsolation(report);
    }).toThrow(IsolationFailure);
  });

  it('catches a target that never sets the tenant for its own call', async () => {
    const report = await checkPoolLeak(fakePool({ noSet: true }));
    expect(report.violations.map((v) => v.check)).toContain('own-tenant');
  });

  it('catches search_path (or role) left changed on a reused connection', async () => {
    const report = await checkPoolLeak(fakePool({ sessionLeak: true }));
    expect(report.violations.map((v) => v.check)).toContain('session-state');
  });

  it('catches a target that swallows the error from tenant work', async () => {
    const report = await checkPoolLeak(fakePool({ swallow: true }));
    expect(report.violations.map((v) => v.check)).toContain('failure');
  });

  it('reports a pool that never reuses a connection as inconclusive, not as passing', async () => {
    const report = await checkPoolLeak(fakePool({ fresh: true }));
    expect(report.sharedConnections).toBe(0);
    expect(report.violations.map((v) => v.check)).toEqual(['reuse']);
  });

  it('refuses unusable options', async () => {
    await expect(checkPoolLeak(fakePool(), { tenants: [TENANT_A, TENANT_A] })).rejects.toThrow(
      RangeError,
    );
    await expect(checkPoolLeak(fakePool(), { rounds: 0 })).rejects.toThrow(RangeError);
    await expect(checkPoolLeak(fakePool(), { tenantSetting: 'no namespace' })).rejects.toThrow(
      RangeError,
    );
  });
});

describe('runTenantMatrix options', () => {
  const never: SqlExecutor = {
    query: () => Promise.reject(new Error('the database must not be reached')),
  };

  it('refuses two identical tenants before touching the database', async () => {
    await expect(
      runTenantMatrix({ sql: never, seeds: {}, tenants: [TENANT_A, TENANT_A] }),
    ).rejects.toThrow(RangeError);
  });

  it('refuses a tenant setting that is not namespace.name', async () => {
    await expect(
      runTenantMatrix({ sql: never, seeds: {}, tenantSetting: 'tenant; DROP' }),
    ).rejects.toThrow(RangeError);
  });
});
