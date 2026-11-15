import { randomBytes } from 'node:crypto';
import type { TenantId } from '@gx/core';
import { CONTRACT_TENANTS } from './contract.ts';
import {
  BLOCKED_STATE,
  DEFAULT_TENANT_SETTING,
  describeError,
  quoteIdent,
  requireTenantSetting,
  sqlState,
  type IsolationReport,
  type IsolationViolation,
  type SqlExecutor,
  type SqlResult,
} from './isolation.ts';

/** What a seed step is told: the tenant it acts for and a value unique per call and per run. */
export interface SeedContext {
  readonly tenantId: TenantId;
  /** Use it for any column with a unique constraint, and to name parent rows. */
  readonly nonce: string;
}

/**
 * How to insert one row into one tenant table. The runner calls `parents` (if any) in the
 * tenant's own context and commits it, then calls `row` for the setup row and again for the
 * probes. `row` must be exactly one INSERT and must not read other tables: the probes need its
 * refusal to come from this table's policy, never from a parent's. Pass what `row` needs (parent
 * ids) through the value `parents` returns.
 */
export interface TableSeed<Parents = unknown> {
  parents?(sql: SqlExecutor, context: SeedContext): Promise<Parents>;
  row(sql: SqlExecutor, context: SeedContext & { readonly parents: Parents }): Promise<void>;
  /**
   * Needed only when the application role may not update `tenant_id` (an immutable tenant
   * column): every other update probe writes that column and would be refused for lack of a
   * grant, never reaching the policy. Run one unfiltered `UPDATE` of a column the role can
   * update, to a constant (`SET note = 'x'`, never `SET col = col`, which reads the column and
   * brings the SELECT policy back in), and return its result.
   */
  touch?(sql: SqlExecutor): Promise<SqlResult>;
}

export interface TenantMatrixOptions {
  /**
   * One dedicated connection logged in as the application role (not a pool, not the owner, no
   * `BYPASSRLS`). The runner checks that the backend stays the same. Run it against a
   * disposable, fully migrated database: seeded rows stay.
   */
  readonly sql: SqlExecutor;
  /** A seed per tenant table, keyed `schema.table`. A tenant table without one fails. */
  readonly seeds: Readonly<Record<string, TableSeed>>;
  /**
   * Relations that are deliberately outside tenant isolation, keyed `schema.table`, with the
   * reason: platform-wide tables without `tenant_id`, or a view or materialized view you have
   * reviewed. An entry that matches nothing, has no reason, or names a table that does have
   * `tenant_id` fails, so the list cannot rot.
   */
  readonly exempt?: Readonly<Record<string, string>>;
  /**
   * Schemas to check. Default: every non-system schema except `ignoreSchemas`, so a table in a
   * schema nobody listed cannot be missed.
   */
  readonly schemas?: readonly string[];
  /**
   * Schemas to leave out when `schemas` is not given. Default `['gx_migrations']`, the
   * migration ledger. The application role must have no privilege there, and the runner fails
   * if it has.
   */
  readonly ignoreSchemas?: readonly string[];
  /** Two different tenants. Default `CONTRACT_TENANTS`. */
  readonly tenants?: readonly [TenantId, TenantId];
  /** Postgres setting that carries the tenant. Default `app.tenant_id` (ADR-0002). */
  readonly tenantSetting?: string;
  /** Pass `true` only while no tenant table exists yet; an empty discovery fails otherwise. */
  readonly allowNoTables?: boolean;
}

export interface TenantMatrixReport extends IsolationReport {
  /** Tenant tables the matrix probed, as `schema.table`. */
  readonly tables: readonly string[];
  /** Relations skipped through `exempt`. */
  readonly exempted: readonly string[];
}

interface Relation {
  readonly name: string;
  readonly kind: string;
  readonly isPartition: boolean;
  readonly hasTenantColumn: boolean;
  readonly tenantNotNull: boolean;
  readonly rlsEnabled: boolean;
  readonly rlsForced: boolean;
  readonly policies: number;
  readonly restrictivePolicies: number;
  readonly connectionOwns: boolean;
  readonly connectionHasPrivileges: boolean;
  readonly securityInvoker: boolean;
}

// A policy applies to the connection when it names PUBLIC (role oid 0) or a role it is a member of.
const POLICY_APPLIES = `(
  '0'::oid = ANY(p.polroles)
  OR EXISTS (SELECT 1 FROM unnest(p.polroles) AS pr(role_oid)
              WHERE pr.role_oid <> '0'::oid AND pg_has_role(current_user, pr.role_oid, 'MEMBER'))
)`;

const DISCOVER = `
SELECT n.nspname || '.' || c.relname AS name,
       c.relkind::text AS kind,
       c.relispartition AS is_partition,
       (a.attnum IS NOT NULL) AS has_tenant,
       COALESCE(a.attnotnull, false) AS tenant_not_null,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid AND ${POLICY_APPLIES})::int AS policies,
       (SELECT count(*) FROM pg_policy p
         WHERE p.polrelid = c.oid AND NOT p.polpermissive AND ${POLICY_APPLIES})::int AS restrictive,
       pg_has_role(current_user, c.relowner, 'MEMBER') AS owns,
       (c.relkind NOT IN ('v', 'm', 'f') AND has_table_privilege(c.oid, 'SELECT,INSERT,UPDATE,DELETE')) AS has_privileges,
       COALESCE(c.reloptions, ARRAY[]::text[]) AS options
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attribute a
    ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND a.attnum > 0 AND NOT a.attisdropped
 WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
   AND CASE WHEN $1::text[] IS NOT NULL THEN n.nspname = ANY($1::text[])
            ELSE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND NOT n.nspname = ANY($2::text[])
       END
 ORDER BY 1`;

const IGNORED_REACHABLE = `
SELECT n.nspname || '.' || c.relname AS name
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind IN ('r', 'p') AND n.nspname = ANY($1::text[])
   AND has_table_privilege(c.oid, 'SELECT,INSERT,UPDATE,DELETE')
 ORDER BY 1`;

const OUTSIDE_REACHABLE = `
SELECT n.nspname || '.' || c.relname AS name
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind IN ('r', 'p')
   AND n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND NOT n.nspname = ANY($1::text[])
   AND has_table_privilege(c.oid, 'SELECT,INSERT,UPDATE,DELETE')
 ORDER BY 1`;

const TENANT_COLUMN_UPDATE = `
SELECT has_column_privilege($1::regclass, 'tenant_id', 'UPDATE') AS can_update_tenant,
       has_any_column_privilege($1::regclass, 'UPDATE') AS can_update_any`;

const CURRENT_ROLE = `
SELECT current_user::text AS role_name,
       COALESCE((SELECT array_agg(r.rolname::text ORDER BY r.rolname) FROM pg_roles r
                  WHERE (r.rolsuper OR r.rolbypassrls) AND pg_has_role(current_user, r.oid, 'MEMBER')),
                ARRAY[]::text[]) AS privileged`;

const FOREIGN_KEYS = `
SELECT cn.nspname || '.' || cc.relname AS child, pn.nspname || '.' || pc.relname AS parent
  FROM pg_constraint k
  JOIN pg_class cc ON cc.oid = k.conrelid JOIN pg_namespace cn ON cn.oid = cc.relnamespace
  JOIN pg_class pc ON pc.oid = k.confrelid JOIN pg_namespace pn ON pn.oid = pc.relnamespace
 WHERE k.contype = 'f'`;

const BACKEND = 'SELECT pg_backend_pid()::text AS pid';

type Violate = (subject: string, check: string, detail: string) => void;

type Outcome<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'blocked' }
  | { readonly kind: 'error'; readonly error: unknown };

/**
 * Discovers every relation in scope and proves tenant isolation from both sides.
 *
 * Structure, read from the catalog. Tenant tables: `tenant_id NOT NULL`, row-level security
 * enabled and forced, a policy that applies to the connection and at least one restrictive one
 * (security-guidelines 4.1), and a connection that is not the owner. Partition children the
 * connection can reach need the same protection. Views must be `security_invoker`; materialized
 * views and foreign tables cannot carry row-level security, so they must be exempted with a
 * reason. The connection's role must not be, or be a member of, a superuser or `BYPASSRLS` role.
 *
 * Behaviour, with a seeded row per tenant. As tenant A: a read sees only A's rows (and at least
 * one, so the check is not vacuous); updates and deletes aimed at B's rows touch 0 rows; an
 * unfiltered update or delete touches no more rows than A can read; moving rows to B and inserting
 * a row for B are refused; with no tenant set nothing is readable and nothing can be inserted.
 * Filtered statements alone are not enough, because the SELECT policy hides rows from a WHERE
 * clause: the unfiltered probes are what test the UPDATE and DELETE policies themselves.
 * A check that cannot run (a seed that fails, say) is a violation, never a skip.
 */
export async function runTenantMatrix(options: TenantMatrixOptions): Promise<TenantMatrixReport> {
  const { sql, seeds } = options;
  const exempt = options.exempt ?? {};
  const explicitSchemas = options.schemas;
  const ignoreSchemas = options.ignoreSchemas ?? ['gx_migrations'];
  const [tenantA, tenantB] =
    options.tenants ?? ([CONTRACT_TENANTS[0], CONTRACT_TENANTS[1]] as const);
  if (tenantA === undefined || tenantB === undefined || tenantA === tenantB) {
    throw new RangeError('The matrix needs two different tenants');
  }
  const setting = requireTenantSetting(options.tenantSetting ?? DEFAULT_TENANT_SETTING);

  const violations: IsolationViolation[] = [];
  const violate: Violate = (subject, check, detail) => {
    violations.push({ subject, check, detail });
  };

  const startPid = await backendPid(sql);
  await checkRole(sql, violate);

  // Tables the role can reach but the matrix will not look at must not exist.
  const unscanned =
    explicitSchemas === undefined
      ? await sql.query(IGNORED_REACHABLE, [ignoreSchemas])
      : await sql.query(OUTSIDE_REACHABLE, [explicitSchemas]);
  for (const row of unscanned.rows) {
    violate(
      String(row['name']),
      explicitSchemas === undefined ? 'ignored-schema' : 'unscanned-schema',
      explicitSchemas === undefined
        ? 'the application role has privileges on a table in an ignored schema'
        : 'the application role has privileges on a table in a schema outside `schemas`: the matrix is not looking at it',
    );
  }

  const relations = (await sql.query(DISCOVER, [explicitSchemas ?? null, ignoreSchemas])).rows.map(
    toRelation,
  );
  const byName = new Map(relations.map((r) => [r.name, r]));

  const exempted: string[] = [];
  for (const [name, reason] of Object.entries(exempt)) {
    const relation = byName.get(name);
    if (relation === undefined)
      violate(name, 'exempt', 'exempt entry matches no discovered relation');
    else if (reason.trim() === '') violate(name, 'exempt', 'exempt entry has no reason');
    else if (isTable(relation) && relation.hasTenantColumn) {
      violate(name, 'exempt', 'table has tenant_id: remove the exemption');
    } else exempted.push(name);
  }

  const tenantTables: Relation[] = [];
  for (const relation of relations) {
    if (exempted.includes(relation.name)) continue;
    if (relation.kind === 'v') {
      if (!relation.securityInvoker) {
        violate(
          relation.name,
          'view',
          'view runs with its owner’s rights: set security_invoker = true (or exempt it, with a reason)',
        );
      }
    } else if (!isTable(relation)) {
      violate(
        relation.name,
        'view',
        'materialized views and foreign tables cannot carry row-level security: exempt it with a reason',
      );
    } else if (relation.isPartition) {
      if (
        relation.connectionHasPrivileges &&
        !(relation.rlsEnabled && relation.rlsForced && relation.policies > 0)
      ) {
        violate(
          relation.name,
          'partition',
          'partition child is reachable by the application role without forced row-level security and a policy (RLS is not inherited): revoke its privileges or protect it',
        );
      }
    } else if (!relation.hasTenantColumn) {
      violate(
        relation.name,
        'tenant-column',
        'no tenant_id column (or list the table in exempt, with a reason)',
      );
    } else {
      tenantTables.push(relation);
    }
  }

  if (tenantTables.length === 0 && options.allowNoTables !== true) {
    violate(
      explicitSchemas?.join(',') ?? 'all schemas',
      'discovery',
      'no tenant table found: the matrix would pass vacuously (wrong schema, or nothing migrated)',
    );
  }

  for (const name of Object.keys(seeds)) {
    if (!tenantTables.some((t) => t.name === name)) {
      violate(name, 'seed', 'seed matches no discovered tenant table');
    }
  }

  // Unique per run as well as per call, so a second run on the same database cannot clash with
  // the rows the first run left behind.
  const runId = randomBytes(4).toString('hex');
  let counter = 0;
  const nextNonce = (): string => `matrix-${runId}-${String((counter += 1))}`;

  // Probe a referenced table before the tables that reference it: a bare DELETE on it fails on
  // the foreign key as soon as a child row exists, which says nothing about isolation.
  const edges = (await sql.query(FOREIGN_KEYS)).rows.map(
    (r) => [String(r['child']), String(r['parent'])] as const,
  );
  for (const table of referencedFirst(tenantTables, edges)) {
    checkStructure(table, violate);
    const seed = seeds[table.name];
    if (seed === undefined) {
      violate(table.name, 'seed', 'no seed supplied for this tenant table');
      continue;
    }
    await probeTable({
      sql,
      table: table.name,
      seed,
      tenantA,
      tenantB,
      setting,
      nextNonce,
      violate,
    });
  }

  if ((await backendPid(sql)) !== startPid) {
    violate(
      'connection',
      'connection',
      'the connection changed backend during the run: pass one dedicated connection, not a pool',
    );
  }

  return Object.freeze({
    tables: Object.freeze(tenantTables.map((t) => t.name)),
    exempted: Object.freeze(exempted),
    violations: Object.freeze(violations),
  });
}

/** Orders tables so each comes after the tables it references; cycles keep name order. */
function referencedFirst(
  tables: readonly Relation[],
  edges: readonly (readonly [child: string, parent: string])[],
): Relation[] {
  const remaining = [...tables].sort((a, b) => a.name.localeCompare(b.name));
  const ordered: Relation[] = [];
  const names = new Set(remaining.map((t) => t.name));
  while (remaining.length > 0) {
    const waiting = new Set(remaining.map((t) => t.name));
    const index = remaining.findIndex((t) =>
      edges.every(
        ([child, parent]) =>
          child !== t.name || parent === t.name || !waiting.has(parent) || !names.has(parent),
      ),
    );
    const [next] = remaining.splice(index === -1 ? 0 : index, 1);
    if (next !== undefined) ordered.push(next);
  }
  return ordered;
}

function isTable(relation: Relation): boolean {
  return relation.kind === 'r' || relation.kind === 'p';
}

async function backendPid(sql: SqlExecutor): Promise<string> {
  const pid = (await sql.query(BACKEND)).rows[0]?.['pid'];
  return typeof pid === 'string' ? pid : 'unknown';
}

async function checkRole(sql: SqlExecutor, violate: Violate): Promise<void> {
  const row = (await sql.query(CURRENT_ROLE)).rows[0];
  if (row === undefined) {
    violate('connection', 'role', 'cannot read the role of this connection');
    return;
  }
  const privileged = Array.isArray(row['privileged']) ? row['privileged'].map(String) : [];
  if (privileged.length > 0) {
    violate(
      'connection',
      'role',
      `the connection's role is, or is a member of, a role that bypasses row-level security (${privileged.join(', ')}): connect as the application role`,
    );
  }
}

function checkStructure(table: Relation, violate: Violate): void {
  if (!table.tenantNotNull) violate(table.name, 'tenant-not-null', 'tenant_id is nullable');
  if (!table.rlsEnabled) violate(table.name, 'rls-enabled', 'row-level security is not enabled');
  if (!table.rlsForced) {
    violate(table.name, 'rls-forced', 'row-level security is not forced for the owner');
  }
  if (table.policies === 0) {
    violate(table.name, 'policy', 'no row-level security policy applies to the application role');
  } else if (table.restrictivePolicies === 0) {
    violate(
      table.name,
      'restrictive-policy',
      'no RESTRICTIVE policy applies: an extra permissive policy added later could open the table',
    );
  }
  if (table.connectionOwns) {
    violate(
      table.name,
      'owner',
      'the connection owns the table (or is a member of its owner): the owner can switch row-level security off',
    );
  }
}

function toRelation(row: Record<string, unknown>): Relation {
  const options = Array.isArray(row['options']) ? row['options'].map(String) : [];
  return {
    name: String(row['name']),
    kind: String(row['kind']),
    isPartition: row['is_partition'] === true,
    hasTenantColumn: row['has_tenant'] === true,
    tenantNotNull: row['tenant_not_null'] === true,
    rlsEnabled: row['rls_enabled'] === true,
    rlsForced: row['rls_forced'] === true,
    policies: Number(row['policies']),
    restrictivePolicies: Number(row['restrictive']),
    connectionOwns: row['owns'] === true,
    connectionHasPrivileges: row['has_privileges'] === true,
    securityInvoker: options.some((o) => /^security_invoker=(true|on|1|yes)$/i.test(o)),
  };
}

interface ProbeInput {
  readonly sql: SqlExecutor;
  readonly table: string;
  readonly seed: TableSeed;
  readonly tenantA: TenantId;
  readonly tenantB: TenantId;
  readonly setting: string;
  readonly nextNonce: () => string;
  readonly violate: Violate;
}

const affected = (result: SqlResult): number => result.rowCount ?? result.rows.length;

async function probeTable(input: ProbeInput): Promise<void> {
  const { sql, table, seed, tenantA, tenantB, setting, nextNonce, violate } = input;
  const target = table.split('.').map(quoteIdent).join('.');

  const inTenant = <T>(
    tenant: TenantId | undefined,
    finish: 'commit' | 'rollback',
    work: () => Promise<T>,
  ): Promise<T> => inTransaction(sql, setting, tenant, finish, work);

  // Setup: parents, then one committed row per tenant, through the tenant's own context.
  const parentsOf = new Map<TenantId, unknown>();
  for (const tenantId of [tenantA, tenantB]) {
    try {
      const parents = await inTenant(tenantId, 'commit', async () =>
        seed.parents === undefined
          ? undefined
          : await seed.parents(sql, { tenantId, nonce: nextNonce() }),
      );
      parentsOf.set(tenantId, parents);
      await inTenant(tenantId, 'commit', () =>
        seed.row(sql, { tenantId, nonce: nextNonce(), parents }),
      );
    } catch (error) {
      violate(table, 'seed', `seed failed: ${describeError(error)}`);
      return;
    }
  }
  // A single INSERT of a row for `tenantId`, using the parents created for that tenant.
  const insertRowFor = (tenantId: TenantId) => (): Promise<void> =>
    seed.row(sql, { tenantId, nonce: nextNonce(), parents: parentsOf.get(tenantId) });

  // Non-vacuity and read isolation: each tenant sees its own rows, and only its own.
  for (const tenant of [tenantA, tenantB]) {
    const read = await attempt(() =>
      inTenant(tenant, 'rollback', () =>
        sql.query(`SELECT tenant_id::text AS tenant FROM ${target}`),
      ),
    );
    if (read.kind !== 'ok') {
      violate(table, 'read', `a tenant cannot read its own rows: ${describeOutcome(read)}`);
      continue;
    }
    const seen = read.value.rows.map((r) => String(r['tenant']));
    if (seen.some((t) => t !== tenant)) {
      violate(table, 'read', `tenant ${label(tenant)} can read rows that are not its own`);
    }
    if (!seen.includes(tenant)) {
      violate(table, 'visibility', `tenant ${label(tenant)} cannot see the row seeded for it`);
    }
  }

  // An immutable tenant column: the role may not update tenant_id, so every probe that writes it is
  // refused for want of a grant. Those probes then say nothing about the UPDATE policy, so the
  // seed's own `touch` has to test it.
  const grants = (await sql.query(TENANT_COLUMN_UPDATE, [target])).rows[0];
  const tenantColumnImmutable =
    grants?.['can_update_tenant'] !== true && grants?.['can_update_any'] === true;
  if (tenantColumnImmutable) {
    if (seed.touch === undefined) {
      violate(
        table,
        'update-untested',
        'the application role cannot update tenant_id, so no update probe reaches the UPDATE policy: give the seed a `touch` step',
      );
    } else {
      const touch = seed.touch.bind(seed);
      expectNoMoreThanVisible(
        violate,
        table,
        'update',
        await attempt(() =>
          inTenant(tenantA, 'rollback', async () => {
            const visible = affected(await sql.query(`SELECT 1 FROM ${target}`));
            const changed = affected(await touch(sql));
            return { visible, changed };
          }),
        ),
      );
    }
  }

  // Filtered writes aimed at tenant B, as tenant A. The SELECT policy hides B's rows from these,
  // so they prove the read side holds; the unfiltered probes below test the write policies.
  const update = await attempt(() =>
    inTenant(tenantA, 'rollback', () =>
      sql.query(`UPDATE ${target} SET tenant_id = tenant_id WHERE tenant_id = $1`, [tenantB]),
    ),
  );
  expectNoRows(violate, table, 'update', update);
  const remove = await attempt(() =>
    inTenant(tenantA, 'rollback', () =>
      sql.query(`DELETE FROM ${target} WHERE tenant_id = $1`, [tenantB]),
    ),
  );
  expectNoRows(violate, table, 'delete', remove);

  // Unfiltered writes as tenant A: no more rows may change than A can read. A WHERE-less
  // statement reads no column, so it meets the UPDATE and DELETE policies without the SELECT policy.
  const visibleThenWrite = (statement: string, values: readonly unknown[]) => () =>
    inTenant(tenantA, 'rollback', async () => {
      const visible = affected(await sql.query(`SELECT 1 FROM ${target}`));
      const changed = affected(await sql.query(statement, values));
      return { visible, changed };
    });
  expectNoMoreThanVisible(
    violate,
    table,
    'delete',
    await attempt(visibleThenWrite(`DELETE FROM ${target}`, [])),
  );
  expectNoMoreThanVisible(
    violate,
    table,
    'update',
    await attempt(visibleThenWrite(`UPDATE ${target} SET tenant_id = $1`, [tenantA])),
  );

  // Moving rows to B, with and without a WHERE, must be refused or touch nothing.
  const moveFiltered = await attempt(() =>
    inTenant(tenantA, 'rollback', () =>
      sql.query(`UPDATE ${target} SET tenant_id = $1 WHERE tenant_id = $2`, [tenantB, tenantA]),
    ),
  );
  expectNoRows(violate, table, 'move', moveFiltered);
  const moveAll = await attempt(() =>
    inTenant(tenantA, 'rollback', () =>
      sql.query(`UPDATE ${target} SET tenant_id = $1`, [tenantB]),
    ),
  );
  expectNoRows(violate, table, 'move', moveAll);

  // Inserting a row for B while acting as A must be refused by this table's policy.
  const insert = await attempt(() => inTenant(tenantA, 'rollback', insertRowFor(tenantB)));
  if (insert.kind !== 'blocked') {
    violate(table, 'insert', `cross-tenant insert was not refused: ${describeOutcome(insert)}`);
  }

  // No tenant context: fail closed on read and on write.
  const bare = await attempt(() =>
    inTenant(undefined, 'rollback', () => sql.query(`SELECT 1 FROM ${target}`)),
  );
  if (bare.kind === 'ok' && affected(bare.value) > 0) {
    violate(
      table,
      'no-context',
      `${String(affected(bare.value))} row(s) readable with no tenant set`,
    );
  }
  // A refusal, or a data error from casting the empty setting, both fail closed. Anything else
  // (a missing column, a type clash) proves nothing about isolation.
  const bareInsert = await attempt(() => inTenant(undefined, 'rollback', insertRowFor(tenantA)));
  if (bareInsert.kind === 'ok') {
    violate(table, 'no-context', 'insert succeeded with no tenant set');
  } else if (bareInsert.kind === 'error' && !sqlState(bareInsert.error)?.startsWith('22')) {
    violate(
      table,
      'no-context',
      `insert with no tenant set failed for an unrelated reason: ${describeOutcome(bareInsert)}`,
    );
  }
}

/** The first and second fixture tenants read as A and B in messages; any other id is shortened. */
function label(tenant: TenantId): string {
  if (tenant === CONTRACT_TENANTS[0]) return 'A';
  if (tenant === CONTRACT_TENANTS[1]) return 'B';
  return tenant.slice(-8);
}

async function inTransaction<T>(
  sql: SqlExecutor,
  setting: string,
  tenant: TenantId | undefined,
  finish: 'commit' | 'rollback',
  work: () => Promise<T>,
): Promise<T> {
  await sql.query('BEGIN');
  try {
    // `true` makes it transaction-local, the way production sets the tenant (ADR-0002).
    if (tenant !== undefined) await sql.query('SELECT set_config($1, $2, true)', [setting, tenant]);
    const value = await work();
    await sql.query(finish === 'commit' ? 'COMMIT' : 'ROLLBACK');
    return value;
  } catch (error) {
    try {
      await sql.query('ROLLBACK');
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'work and ROLLBACK both failed', {
        cause: rollbackError,
      });
    }
    throw error;
  }
}

async function attempt<T>(run: () => Promise<T>): Promise<Outcome<T>> {
  try {
    return { kind: 'ok', value: await run() };
  } catch (error) {
    return sqlState(error) === BLOCKED_STATE ? { kind: 'blocked' } : { kind: 'error', error };
  }
}

function describeOutcome(outcome: Outcome<unknown>): string {
  if (outcome.kind === 'ok') return 'it succeeded';
  if (outcome.kind === 'blocked') return `refused (SQLSTATE ${BLOCKED_STATE})`;
  const hint =
    sqlState(outcome.error) === '23503'
      ? ' (a foreign key stopped the probe: rows from an earlier run or another table reference these rows; run on a fresh database)'
      : '';
  return `${describeError(outcome.error)}${hint}`;
}

/** Isolated when the statement affected 0 rows or was refused. */
function expectNoRows(
  violate: Violate,
  table: string,
  check: string,
  outcome: Outcome<SqlResult>,
): void {
  if (outcome.kind === 'blocked') return;
  if (outcome.kind === 'ok' && affected(outcome.value) === 0) return;
  const got =
    outcome.kind === 'ok' ? `${String(affected(outcome.value))} row(s)` : describeOutcome(outcome);
  violate(table, check, `expected 0 rows or a refusal, got ${got}`);
}

/** Isolated when the write changed no more rows than the caller could read, or was refused. */
function expectNoMoreThanVisible(
  violate: Violate,
  table: string,
  check: string,
  outcome: Outcome<{ visible: number; changed: number }>,
): void {
  if (outcome.kind === 'blocked') return;
  if (outcome.kind === 'ok' && outcome.value.changed <= outcome.value.visible) return;
  const got =
    outcome.kind === 'ok'
      ? `${String(outcome.value.changed)} row(s) changed but only ${String(outcome.value.visible)} readable: another tenant's rows were hit`
      : describeOutcome(outcome);
  violate(table, check, `unfiltered statement: ${got}`);
}
