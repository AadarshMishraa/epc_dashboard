import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  TENANT_A,
  TENANT_B,
  checkPoolLeak,
  runTenantMatrix,
  type PoolLeakTarget,
  type SqlExecutor,
  type TableSeed,
  type TenantMatrixOptions,
} from './index.ts';

// Self-test of the isolation helpers: a good table must pass, and every kind of bad table must
// fail for the right reason. Each test gets its own empty database and its own login role.
const adminUrl = process.env['GX_TEST_DATABASE_URL'];
let admin: pg.Client;
const cleanup: (() => Promise<void>)[] = [];

beforeAll(async () => {
  if (adminUrl === undefined || adminUrl === '') {
    throw new Error(
      'GX_TEST_DATABASE_URL is not set: database tests need a Postgres the test role can create databases and roles on',
    );
  }
  admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
});

afterEach(async () => {
  for (const step of cleanup.splice(0).reverse()) await step();
});

afterAll(async () => {
  await admin.end();
});

const matchOn = (setting: string, column = 'tenant_id'): string =>
  `${column} = nullif(current_setting('${setting}', true), '')::uuid`;
const TENANT_MATCH = matchOn('app.tenant_id');
const GRANT = 'SELECT, INSERT, UPDATE, DELETE';

/** The policy set the guidelines ask for: a restrictive tenant policy plus a permissive allow. */
const isolating = (match = TENANT_MATCH): readonly string[] => [
  `AS RESTRICTIVE FOR ALL USING (${match}) WITH CHECK (${match})`,
  'AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true)',
];

interface Database {
  /** Runs as the superuser that created the database, for DDL. */
  readonly owner: pg.Client;
  /** Logged in as the application role: a plain role with no `BYPASSRLS`. */
  readonly app: pg.Client;
  readonly appRole: string;
  readonly appUrl: string;
}

async function freshDatabase(): Promise<Database> {
  const suffix = randomBytes(6).toString('hex');
  const dbName = `gx_t_${suffix}`;
  const appRole = `gx_t_app_${suffix}`;
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.query(`CREATE ROLE ${appRole} LOGIN PASSWORD 'pw'`);
  const url = new URL(adminUrl ?? '');
  url.pathname = `/${dbName}`;
  const owner = new pg.Client({ connectionString: url.toString() });
  await owner.connect();
  const appUrl = new URL(url);
  appUrl.username = appRole;
  appUrl.password = 'pw';
  const app = new pg.Client({ connectionString: appUrl.toString() });
  await app.connect();
  cleanup.push(async () => {
    await app.end();
    await owner.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin.query(`DROP ROLE IF EXISTS ${appRole}`);
  });
  return { owner, app, appRole, appUrl: appUrl.toString() };
}

interface TableSpec {
  readonly name?: string;
  readonly tenantColumn?: string;
  readonly enableRls?: boolean;
  readonly forceRls?: boolean;
  /** Policy bodies, everything after `CREATE POLICY pN ON table`. Default: `isolating()`. */
  readonly policies?: readonly string[];
  /** Extra columns and constraints, for example a foreign key. */
  readonly extra?: string;
}

async function createTable(db: Database, spec: TableSpec = {}): Promise<string> {
  const name = spec.name ?? 'widget';
  const tenantColumn = spec.tenantColumn ?? 'tenant_id uuid NOT NULL';
  await db.owner.query(
    `CREATE TABLE ${name} (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ${tenantColumn}, label text UNIQUE${spec.extra ?? ''})`,
  );
  await protect(db, name, spec);
  return `public.${name}`;
}

async function protect(db: Database, name: string, spec: TableSpec = {}): Promise<void> {
  if (spec.enableRls !== false) {
    await db.owner.query(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`);
  }
  if (spec.forceRls !== false) await db.owner.query(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`);
  for (const [i, body] of (spec.policies ?? isolating()).entries()) {
    await db.owner.query(`CREATE POLICY p${String(i)} ON ${name} ${body}`);
  }
  await db.owner.query(`GRANT ${GRANT} ON ${name} TO ${db.appRole}`);
}

const seedWidget = (table = 'widget'): TableSeed => ({
  row: async (sql, { tenantId, nonce }) => {
    await sql.query(`INSERT INTO ${table} (tenant_id, label) VALUES ($1, $2)`, [tenantId, nonce]);
  },
});

function matrix(db: Database, extra: Partial<TenantMatrixOptions> = {}) {
  return runTenantMatrix({
    sql: db.app,
    seeds: { 'public.widget': seedWidget() },
    tenants: [TENANT_A, TENANT_B],
    ...extra,
  });
}

const checks = (violations: readonly { check: string }[]): string[] => [
  ...new Set(violations.map((v) => v.check)),
];

describe('runTenantMatrix', () => {
  it('passes a table with forced row-level security and an isolating policy', async () => {
    const db = await freshDatabase();
    await createTable(db);
    const report = await matrix(db);
    expect(report.violations).toEqual([]);
    expect(report.tables).toEqual(['public.widget']);
  });

  it('can run twice on one database: seeds use fresh unique values each run', async () => {
    const db = await freshDatabase();
    await createTable(db);
    expect((await matrix(db)).violations).toEqual([]);
    expect((await matrix(db)).violations).toEqual([]);
  });

  it('discovers every table, not just the one it was told about', async () => {
    const db = await freshDatabase();
    await createTable(db);
    await createTable(db, { name: 'gadget' });
    const report = await matrix(db, {
      seeds: { 'public.widget': seedWidget(), 'public.gadget': seedWidget('gadget') },
    });
    expect(report.violations).toEqual([]);
    expect(report.tables).toEqual(['public.gadget', 'public.widget']);
  });

  it('fails a table without a policy, and says so (K0-T06 done-when)', async () => {
    const db = await freshDatabase();
    await createTable(db, { policies: [] });
    const report = await matrix(db);
    expect(report.violations).toContainEqual(
      expect.objectContaining({ subject: 'public.widget', check: 'policy' }),
    );
  });

  it('fails a table whose only policy is for another role', async () => {
    // Created before the database so its cleanup runs after the database (and its policy) is gone.
    const other = `gx_t_other_${randomBytes(4).toString('hex')}`;
    await admin.query(`CREATE ROLE ${other}`);
    cleanup.push(() => admin.query(`DROP ROLE IF EXISTS ${other}`).then(() => undefined));
    const db = await freshDatabase();
    await createTable(db, { policies: [`AS PERMISSIVE FOR ALL TO ${other} USING (true)`] });
    const report = await matrix(db);
    expect(checks(report.violations)).toContain('policy');
  });

  it('fails a table with only permissive policies: no restrictive guard (guidelines 4.1)', async () => {
    const db = await freshDatabase();
    await createTable(db, {
      policies: [`AS PERMISSIVE FOR ALL USING (${TENANT_MATCH}) WITH CHECK (${TENANT_MATCH})`],
    });
    const report = await matrix(db);
    expect(checks(report.violations)).toEqual(['restrictive-policy']);
  });

  it('fails a table with row-level security off, and shows the leak it allows', async () => {
    const db = await freshDatabase();
    await createTable(db, { enableRls: false, forceRls: false, policies: [] });
    const report = await matrix(db);
    expect(checks(report.violations)).toEqual(
      expect.arrayContaining(['rls-enabled', 'rls-forced', 'policy', 'read']),
    );
  });

  it('fails a table where row-level security is enabled but not forced', async () => {
    const db = await freshDatabase();
    await createTable(db, { forceRls: false });
    const report = await matrix(db);
    expect(checks(report.violations)).toEqual(['rls-forced']);
  });

  it('fails a permissive policy on every operation', async () => {
    const db = await freshDatabase();
    await createTable(db, { policies: ['USING (true) WITH CHECK (true)'] });
    const report = await matrix(db);
    expect(checks(report.violations)).toEqual(
      expect.arrayContaining([
        'read',
        'update',
        'delete',
        'move',
        'insert',
        'no-context',
        'restrictive-policy',
      ]),
    );
  });

  it('catches update and delete policies that are open even when SELECT is isolating', async () => {
    // The SELECT policy hides other tenants' rows from any statement with a WHERE clause, so a
    // filtered probe sees nothing wrong. A bare `DELETE FROM t` or `UPDATE t SET ...` reaches them.
    const db = await freshDatabase();
    await createTable(db, {
      policies: [
        `AS PERMISSIVE FOR SELECT USING (${TENANT_MATCH})`,
        `AS PERMISSIVE FOR INSERT WITH CHECK (${TENANT_MATCH})`,
        'AS PERMISSIVE FOR UPDATE USING (true) WITH CHECK (true)',
        'AS PERMISSIVE FOR DELETE USING (true)',
      ],
    });
    const report = await matrix(db);
    expect(checks(report.violations)).toEqual(expect.arrayContaining(['update', 'delete', 'move']));
    expect(checks(report.violations)).not.toContain('read');
    expect(checks(report.violations)).not.toContain('insert');
  });

  it('catches an update policy whose WITH CHECK lets a tenant push rows into another tenant', async () => {
    const db = await freshDatabase();
    await createTable(db, {
      policies: [
        `AS PERMISSIVE FOR SELECT USING (${TENANT_MATCH})`,
        `AS PERMISSIVE FOR INSERT WITH CHECK (${TENANT_MATCH})`,
        `AS PERMISSIVE FOR UPDATE USING (${TENANT_MATCH}) WITH CHECK (true)`,
        `AS PERMISSIVE FOR DELETE USING (${TENANT_MATCH})`,
      ],
    });
    const report = await matrix(db);
    expect(checks(report.violations)).toContain('move');
    expect(checks(report.violations)).not.toContain('read');
    expect(checks(report.violations)).not.toContain('delete');
  });

  it('catches an ALL policy with a loose WITH CHECK on insert', async () => {
    const db = await freshDatabase();
    await createTable(db, {
      policies: [`AS PERMISSIVE FOR ALL USING (${TENANT_MATCH}) WITH CHECK (true)`],
    });
    const report = await matrix(db);
    expect(checks(report.violations)).toEqual(expect.arrayContaining(['insert', 'no-context']));
  });

  it('fails a policy that opens up when no tenant is set', async () => {
    const db = await freshDatabase();
    const open = `tenant_id = coalesce(nullif(current_setting('app.tenant_id', true), '')::uuid, tenant_id)`;
    await createTable(db, {
      policies: [
        `AS RESTRICTIVE FOR ALL USING (${open}) WITH CHECK (${open})`,
        ...isolating().slice(1),
      ],
    });
    const report = await matrix(db);
    expect(checks(report.violations)).toContain('no-context');
  });

  it('catches a read that opens up when no tenant is set, even if writes stay closed', async () => {
    const db = await freshDatabase();
    const open = `tenant_id = coalesce(nullif(current_setting('app.tenant_id', true), '')::uuid, tenant_id)`;
    await createTable(db, {
      policies: [
        `AS PERMISSIVE FOR SELECT USING (${open})`,
        `AS PERMISSIVE FOR INSERT WITH CHECK (${TENANT_MATCH})`,
        `AS PERMISSIVE FOR UPDATE USING (${TENANT_MATCH})`,
        `AS PERMISSIVE FOR DELETE USING (${TENANT_MATCH})`,
      ],
    });
    const report = await matrix(db);
    expect(report.violations).toContainEqual(
      expect.objectContaining({
        check: 'no-context',
        detail: expect.stringContaining('readable') as unknown,
      }),
    );
    expect(
      report.violations.some((v) => v.check === 'no-context' && v.detail.includes('insert')),
    ).toBe(false);
  });

  it('fails a tenant that cannot see the row seeded for it, so a vacuous pass is impossible', async () => {
    const db = await freshDatabase();
    await createTable(db, {
      policies: [
        'AS PERMISSIVE FOR SELECT USING (false)',
        `AS PERMISSIVE FOR INSERT WITH CHECK (${TENANT_MATCH})`,
        `AS PERMISSIVE FOR UPDATE USING (${TENANT_MATCH})`,
        `AS PERMISSIVE FOR DELETE USING (${TENANT_MATCH})`,
      ],
    });
    const report = await matrix(db);
    expect(checks(report.violations)).toContain('visibility');
  });

  describe('an immutable tenant_id column', () => {
    // The role may update `note` but not `tenant_id`: every probe that writes tenant_id is refused
    // for want of a grant, so only the seed's `touch` step can reach the UPDATE policy.
    async function immutable(db: Database, updatePolicy: string): Promise<void> {
      await createTable(db, {
        extra: ', note text',
        policies: [
          `AS PERMISSIVE FOR SELECT USING (${TENANT_MATCH})`,
          `AS PERMISSIVE FOR INSERT WITH CHECK (${TENANT_MATCH})`,
          `AS PERMISSIVE FOR UPDATE ${updatePolicy}`,
          `AS PERMISSIVE FOR DELETE USING (${TENANT_MATCH})`,
        ],
      });
      await db.owner.query(`REVOKE UPDATE ON widget FROM ${db.appRole}`);
      await db.owner.query(`GRANT UPDATE (note) ON widget TO ${db.appRole}`);
    }
    const withTouch: TableSeed = {
      ...seedWidget(),
      touch: (sql) => sql.query("UPDATE widget SET note = 'touched'"),
    };

    it('reports update-untested when the seed has no touch step', async () => {
      const db = await freshDatabase();
      await immutable(db, 'USING (true)');
      const report = await matrix(db);
      expect(checks(report.violations)).toContain('update-untested');
    });

    it('catches an open UPDATE policy through the touch step', async () => {
      const db = await freshDatabase();
      await immutable(db, 'USING (true)');
      const report = await matrix(db, { seeds: { 'public.widget': withTouch } });
      expect(report.violations).toContainEqual(
        expect.objectContaining({
          check: 'update',
          detail: expect.stringContaining('only 1 readable') as unknown,
        }),
      );
      expect(checks(report.violations)).not.toContain('update-untested');
    });

    it('passes a sound UPDATE policy through the touch step', async () => {
      const db = await freshDatabase();
      await immutable(db, `USING (${TENANT_MATCH})`);
      const report = await matrix(db, { seeds: { 'public.widget': withTouch } });
      expect(checks(report.violations)).toEqual(['restrictive-policy']);
    });
  });

  it('flags a reachable table outside an explicit schema list', async () => {
    const db = await freshDatabase();
    await createTable(db);
    await db.owner.query('CREATE SCHEMA other');
    await db.owner.query('CREATE TABLE other.stray (key text)');
    await db.owner.query(`GRANT SELECT ON other.stray TO ${db.appRole}`);
    const report = await matrix(db, { schemas: ['public'] });
    expect(report.violations).toEqual([
      expect.objectContaining({ subject: 'other.stray', check: 'unscanned-schema' }),
    ]);
  });

  it('flags a connection that is a NOINHERIT member of the table owner', async () => {
    // Created before the database so its cleanup runs after the database (and its table) is gone.
    const ownerRole = `gx_t_owner_${randomBytes(4).toString('hex')}`;
    await admin.query(`CREATE ROLE ${ownerRole}`);
    cleanup.push(() => admin.query(`DROP ROLE IF EXISTS ${ownerRole}`).then(() => undefined));
    const db = await freshDatabase();
    await createTable(db);
    await db.owner.query(`ALTER TABLE widget OWNER TO ${ownerRole}`);
    await admin.query(`ALTER ROLE ${db.appRole} NOINHERIT`);
    await admin.query(`GRANT ${ownerRole} TO ${db.appRole}`);
    await db.owner.query(`GRANT ${GRANT} ON widget TO ${db.appRole}`);
    const report = await matrix(db);
    expect(checks(report.violations)).toContain('owner');
  });

  it('says why a rerun fails on a parent table that already has child rows', async () => {
    const db = await freshDatabase();
    await createTable(db, { name: 'parent' });
    await createTable(db, {
      name: 'child',
      extra: ', parent_id uuid NOT NULL REFERENCES parent (id)',
    });
    const childSeed: TableSeed<{ parentId: string }> = {
      parents: async (sql, { tenantId, nonce }) => {
        const result = await sql.query(
          'INSERT INTO parent (tenant_id, label) VALUES ($1, $2) RETURNING id',
          [tenantId, `p-${nonce}`],
        );
        return { parentId: String(result.rows[0]?.['id']) };
      },
      row: async (sql, { tenantId, nonce, parents }) => {
        await sql.query('INSERT INTO child (tenant_id, parent_id, label) VALUES ($1, $2, $3)', [
          tenantId,
          parents.parentId,
          nonce,
        ]);
      },
    };
    const seeds = { 'public.parent': seedWidget('parent'), 'public.child': childSeed };
    expect((await matrix(db, { seeds })).violations).toEqual([]);
    const second = await matrix(db, { seeds });
    expect(second.violations).toContainEqual(
      expect.objectContaining({
        subject: 'public.parent',
        detail: expect.stringContaining('fresh database') as unknown,
      }),
    );
  });

  it('catches a child table whose loose insert policy a parent refusal would have hidden', async () => {
    const db = await freshDatabase();
    await createTable(db, { name: 'parent' });
    const childSeed: TableSeed<{ parentId: string }> = {
      parents: async (sql, { tenantId, nonce }) => {
        const result = await sql.query(
          'INSERT INTO parent (tenant_id, label) VALUES ($1, $2) RETURNING id',
          [tenantId, `p-${nonce}`],
        );
        return { parentId: String(result.rows[0]?.['id']) };
      },
      row: async (sql, { tenantId, nonce, parents }) => {
        await sql.query('INSERT INTO child (tenant_id, parent_id, label) VALUES ($1, $2, $3)', [
          tenantId,
          parents.parentId,
          nonce,
        ]);
      },
    };
    const seeds = { 'public.parent': seedWidget('parent'), 'public.child': childSeed };
    const childDdl = 'parent_id uuid NOT NULL REFERENCES parent (id)';

    await createTable(db, {
      name: 'child',
      extra: `, ${childDdl}`,
      policies: [
        `AS PERMISSIVE FOR SELECT USING (${TENANT_MATCH})`,
        'AS PERMISSIVE FOR INSERT WITH CHECK (true)',
        `AS PERMISSIVE FOR UPDATE USING (${TENANT_MATCH})`,
        `AS PERMISSIVE FOR DELETE USING (${TENANT_MATCH})`,
      ],
    });
    const report = await matrix(db, { seeds });
    expect(report.violations).toContainEqual(
      expect.objectContaining({ subject: 'public.child', check: 'insert' }),
    );
    expect(report.violations.filter((v) => v.subject === 'public.parent')).toEqual([]);
  });

  it('passes a child table with parents when its own policy is sound', async () => {
    const db = await freshDatabase();
    await createTable(db, { name: 'parent' });
    await createTable(db, {
      name: 'child',
      extra: ', parent_id uuid NOT NULL REFERENCES parent (id)',
    });
    const childSeed: TableSeed<{ parentId: string }> = {
      parents: async (sql, { tenantId, nonce }) => {
        const result = await sql.query(
          'INSERT INTO parent (tenant_id, label) VALUES ($1, $2) RETURNING id',
          [tenantId, `p-${nonce}`],
        );
        return { parentId: String(result.rows[0]?.['id']) };
      },
      row: async (sql, { tenantId, nonce, parents }) => {
        await sql.query('INSERT INTO child (tenant_id, parent_id, label) VALUES ($1, $2, $3)', [
          tenantId,
          parents.parentId,
          nonce,
        ]);
      },
    };
    const report = await matrix(db, {
      seeds: { 'public.parent': seedWidget('parent'), 'public.child': childSeed },
    });
    expect(report.violations).toEqual([]);
  });

  it('fails a nullable tenant column', async () => {
    const db = await freshDatabase();
    await createTable(db, { tenantColumn: 'tenant_id uuid' });
    const report = await matrix(db);
    expect(checks(report.violations)).toEqual(['tenant-not-null']);
  });

  it('fails a table without a tenant column unless it is exempt with a reason', async () => {
    const db = await freshDatabase();
    await createTable(db);
    await db.owner.query('CREATE TABLE platform_flag (key text PRIMARY KEY)');
    await db.owner.query(`GRANT SELECT ON platform_flag TO ${db.appRole}`);

    const bare = await matrix(db);
    expect(bare.violations).toContainEqual(
      expect.objectContaining({ subject: 'public.platform_flag', check: 'tenant-column' }),
    );

    const exempted = await matrix(db, {
      exempt: { 'public.platform_flag': 'platform-wide feature flags, no tenant data' },
    });
    expect(exempted.violations).toEqual([]);
    expect(exempted.exempted).toEqual(['public.platform_flag']);
  });

  it('keeps the exempt list honest: no reason, no such table, or a table with tenant_id', async () => {
    const db = await freshDatabase();
    await createTable(db);
    await db.owner.query('CREATE TABLE platform_flag (key text PRIMARY KEY)');
    const report = await matrix(db, {
      exempt: {
        'public.platform_flag': '  ',
        'public.gone': 'was dropped',
        'public.widget': 'tenant data, wrongly exempted',
      },
    });
    const exemptViolations = report.violations.filter((v) => v.check === 'exempt');
    expect(exemptViolations.map((v) => v.subject).sort()).toEqual([
      'public.gone',
      'public.platform_flag',
      'public.widget',
    ]);
  });

  it('fails a tenant table with no seed, and a seed with no table', async () => {
    const db = await freshDatabase();
    await createTable(db);
    const report = await matrix(db, { seeds: { 'public.ghost': seedWidget() } });
    expect(report.violations).toContainEqual(
      expect.objectContaining({
        subject: 'public.widget',
        check: 'seed',
        detail: expect.stringContaining('no seed supplied') as unknown,
      }),
    );
    expect(report.violations).toContainEqual(
      expect.objectContaining({ subject: 'public.ghost', check: 'seed' }),
    );
  });

  it('reports a seed that fails instead of skipping the table', async () => {
    const db = await freshDatabase();
    await createTable(db);
    const report = await matrix(db, {
      seeds: {
        'public.widget': {
          row: async (sql) => {
            await sql.query('INSERT INTO widget (tenant_id) VALUES (NULL)');
          },
        },
      },
    });
    expect(report.violations).toContainEqual(
      expect.objectContaining({ subject: 'public.widget', check: 'seed' }),
    );
  });

  it('reports a probe that fails for another reason as inconclusive, not as refused', async () => {
    const db = await freshDatabase();
    await createTable(db);
    const report = await matrix(db, {
      seeds: {
        'public.widget': {
          row: async (sql, { tenantId, nonce }) => {
            // Fails with a plain error (not a policy refusal) unless the tenant context matches.
            const set = await sql.query("SELECT current_setting('app.tenant_id', true) AS t");
            if (set.rows[0]?.['t'] !== tenantId) throw new Error('context mismatch');
            await sql.query('INSERT INTO widget (tenant_id, label) VALUES ($1, $2)', [
              tenantId,
              nonce,
            ]);
          },
        },
      },
    });
    expect(checks(report.violations)).toEqual(['insert', 'no-context']);
    expect(report.violations.every((v) => v.detail.includes('context mismatch'))).toBe(true);
  });

  it('does not take any SQL error for a refusal: only SQLSTATE 42501 counts', async () => {
    const db = await freshDatabase();
    await createTable(db);
    const report = await matrix(db, {
      seeds: {
        'public.widget': {
          row: async (sql, { tenantId, nonce }) => {
            const set = await sql.query("SELECT current_setting('app.tenant_id', true) AS t");
            // 22012 (division by zero) is a real SQL error that is not a policy refusal.
            if (set.rows[0]?.['t'] !== tenantId) await sql.query('SELECT 1 / 0');
            await sql.query('INSERT INTO widget (tenant_id, label) VALUES ($1, $2)', [
              tenantId,
              nonce,
            ]);
          },
        },
      },
    });
    expect(report.violations).toEqual([
      expect.objectContaining({
        check: 'insert',
        detail: expect.stringContaining('22012') as unknown,
      }),
    ]);
  });

  it('refuses to vouch for a connection that bypasses row-level security', async () => {
    const db = await freshDatabase();
    await createTable(db);
    // The owner here is the superuser that created the database.
    const report = await matrix(db, { sql: db.owner });
    expect(checks(report.violations)).toEqual(expect.arrayContaining(['role', 'owner']));
  });

  it('flags a role that is a member of a BYPASSRLS role', async () => {
    const db = await freshDatabase();
    await createTable(db);
    const bypasser = `gx_t_bypass_${randomBytes(4).toString('hex')}`;
    await admin.query(`CREATE ROLE ${bypasser} BYPASSRLS`);
    cleanup.push(() => admin.query(`DROP ROLE IF EXISTS ${bypasser}`).then(() => undefined));
    await admin.query(`GRANT ${bypasser} TO ${db.appRole}`);
    const report = await matrix(db);
    expect(report.violations).toContainEqual(
      expect.objectContaining({ subject: 'connection', check: 'role' }),
    );
  });

  it('flags a connection that owns the table, even with forced row-level security', async () => {
    const db = await freshDatabase();
    await createTable(db);
    await db.owner.query(`ALTER TABLE widget OWNER TO ${db.appRole}`);
    const report = await matrix(db);
    expect(checks(report.violations)).toEqual(['owner']);
  });

  it('fails an empty database unless told no tables exist yet', async () => {
    const db = await freshDatabase();
    const empty = await matrix(db, { seeds: {} });
    expect(checks(empty.violations)).toEqual(['discovery']);
    const allowed = await matrix(db, { seeds: {}, allowNoTables: true });
    expect(allowed.violations).toEqual([]);
  });

  it('checks every non-system schema by default, so no table hides in an unlisted one', async () => {
    const db = await freshDatabase();
    await db.owner.query('CREATE SCHEMA other');
    await db.owner.query('CREATE TABLE other.stray (key text)');
    await createTable(db);
    const byDefault = await matrix(db);
    expect(byDefault.violations).toContainEqual(
      expect.objectContaining({ subject: 'other.stray', check: 'tenant-column' }),
    );
    const scoped = await matrix(db, { schemas: ['public'] });
    expect(scoped.tables).toEqual(['public.widget']);
    expect(scoped.violations).toEqual([]);
  });

  it('ignores the migration ledger schema, but fails if the application role can reach it', async () => {
    const db = await freshDatabase();
    await createTable(db);
    await db.owner.query('CREATE SCHEMA gx_migrations');
    await db.owner.query('CREATE TABLE gx_migrations.ledger (id int)');
    expect((await matrix(db)).violations).toEqual([]);
    await db.owner.query(`GRANT SELECT ON gx_migrations.ledger TO ${db.appRole}`);
    const reachable = await matrix(db);
    expect(reachable.violations).toEqual([
      expect.objectContaining({ subject: 'gx_migrations.ledger', check: 'ignored-schema' }),
    ]);
  });

  it('fails a view that runs with its owner’s rights, and a materialized view', async () => {
    const db = await freshDatabase();
    await createTable(db);
    await db.owner.query('CREATE VIEW leaky AS SELECT * FROM widget');
    await db.owner.query('CREATE VIEW safe WITH (security_invoker = true) AS SELECT * FROM widget');
    await db.owner.query('CREATE MATERIALIZED VIEW snapshot AS SELECT * FROM widget');
    const report = await matrix(db);
    const viewViolations = report.violations.filter((v) => v.check === 'view');
    expect(viewViolations.map((v) => v.subject).sort()).toEqual([
      'public.leaky',
      'public.snapshot',
    ]);

    const reviewed = await matrix(db, {
      exempt: {
        'public.leaky': 'drop it next release; only the platform team can read it',
        'public.snapshot': 'platform-wide aggregate with no tenant rows',
      },
    });
    expect(reviewed.violations).toEqual([]);
  });

  describe('partitioned tables', () => {
    async function createPartitioned(db: Database): Promise<void> {
      await db.owner.query(
        `CREATE TABLE widget (id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, label text,
           PRIMARY KEY (id, tenant_id)) PARTITION BY HASH (tenant_id)`,
      );
      await db.owner.query(
        'CREATE TABLE widget_0 PARTITION OF widget FOR VALUES WITH (MODULUS 2, REMAINDER 0)',
      );
      await db.owner.query(
        'CREATE TABLE widget_1 PARTITION OF widget FOR VALUES WITH (MODULUS 2, REMAINDER 1)',
      );
      await protect(db, 'widget');
    }

    it('passes when the children are reachable only through the parent', async () => {
      const db = await freshDatabase();
      await createPartitioned(db);
      const report = await matrix(db);
      expect(report.violations).toEqual([]);
      expect(report.tables).toEqual(['public.widget']);
    });

    it('fails children the application role can read directly: RLS is not inherited', async () => {
      const db = await freshDatabase();
      await createPartitioned(db);
      await db.owner.query(`GRANT SELECT ON widget_0, widget_1 TO ${db.appRole}`);
      const report = await matrix(db);
      expect(report.violations.map((v) => `${v.subject}:${v.check}`).sort()).toEqual([
        'public.widget_0:partition',
        'public.widget_1:partition',
      ]);
    });

    it('passes children that are reachable but protected themselves', async () => {
      const db = await freshDatabase();
      await createPartitioned(db);
      for (const child of ['widget_0', 'widget_1']) await protect(db, child);
      const report = await matrix(db);
      expect(report.violations).toEqual([]);
    });
  });

  it('quotes table names that need it (capitals, spaces, reserved words)', async () => {
    const db = await freshDatabase();
    for (const name of ['"Order Item"', '"user"']) {
      await createTable(db, { name });
    }
    const report = await matrix(db, {
      seeds: {
        'public.Order Item': seedWidget('"Order Item"'),
        'public.user': seedWidget('"user"'),
      },
    });
    expect(report.violations).toEqual([]);
    expect(report.tables).toEqual(['public.Order Item', 'public.user']);
  });

  it('works with a text tenant column as well as uuid', async () => {
    const db = await freshDatabase();
    const match = `tenant_id = current_setting('app.tenant_id', true)`;
    await createTable(db, { tenantColumn: 'tenant_id text NOT NULL', policies: isolating(match) });
    const report = await matrix(db);
    expect(report.violations).toEqual([]);
  });

  it('honours a custom tenant setting name', async () => {
    const db = await freshDatabase();
    await createTable(db, { policies: isolating(matchOn('acme.tenant')) });
    expect((await matrix(db)).violations.length).toBeGreaterThan(0);
    expect((await matrix(db, { tenantSetting: 'acme.tenant' })).violations).toEqual([]);
  });

  it('fails when the connection is really a pool that changes backend', async () => {
    const db = await freshDatabase();
    await createTable(db);
    let calls = 0;
    const roaming: SqlExecutor = {
      query: async (text, values) => {
        const result = await db.app.query(text, values as unknown[] | undefined);
        if (text.includes('pg_backend_pid')) {
          calls += 1;
          return { rows: [{ pid: String(calls) }], rowCount: 1 };
        }
        return result;
      },
    };
    const report = await matrix(db, { sql: roaming });
    expect(report.violations).toContainEqual(
      expect.objectContaining({ subject: 'connection', check: 'connection' }),
    );
  });

  it('leaves the connection usable and clean after a run', async () => {
    const db = await freshDatabase();
    await createTable(db, { policies: ['USING (true) WITH CHECK (true)'] });
    await matrix(db);
    // No transaction left open: a stray one would make this BEGIN warn and the ROLLBACK end it.
    const open = await db.app.query('SELECT now() = statement_timestamp() AS fresh');
    expect((open.rows as Record<string, unknown>[])[0]?.['fresh']).toBe(true);
    await db.app.query('BEGIN');
    await db.app.query('ROLLBACK');
  });
});

describe('checkPoolLeak against a real pool', () => {
  function poolTarget(
    db: Database,
    options: { sessionLevel?: boolean; swallow?: boolean; max?: number } = {},
  ): { target: PoolLeakTarget; close: () => Promise<void> } {
    const pool = new pg.Pool({ connectionString: db.appUrl, max: options.max ?? 1 });
    const target: PoolLeakTarget = {
      async runAs(tenantId, work) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          // `false` makes the setting last for the whole session: the bug the check hunts for.
          await client.query('SELECT set_config($1, $2, $3)', [
            'app.tenant_id',
            tenantId,
            options.sessionLevel !== true,
          ]);
          await work(client);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          if (options.swallow !== true) throw error;
        } finally {
          client.release();
        }
      },
      async runWithoutTenant(work) {
        const client = await pool.connect();
        try {
          await work(client);
        } finally {
          client.release();
        }
      },
    };
    return { target, close: () => pool.end() };
  }

  it('passes when the tenant is set per transaction', async () => {
    const db = await freshDatabase();
    const { target, close } = poolTarget(db);
    cleanup.push(close);
    const report = await checkPoolLeak(target);
    expect(report.violations).toEqual([]);
    expect(report.sharedConnections).toBe(1);
  });

  it('catches a tenant set for the whole session', async () => {
    const db = await freshDatabase();
    const { target, close } = poolTarget(db, { sessionLevel: true });
    cleanup.push(close);
    const report = await checkPoolLeak(target);
    expect(checks(report.violations)).toContain('leak');
  });

  it('catches a wrapper that swallows errors from tenant work', async () => {
    const db = await freshDatabase();
    const { target, close } = poolTarget(db, { swallow: true });
    cleanup.push(close);
    const report = await checkPoolLeak(target);
    expect(checks(report.violations)).toContain('failure');
  });
});
