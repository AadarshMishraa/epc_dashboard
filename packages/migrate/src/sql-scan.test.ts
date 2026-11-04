import { describe, expect, it } from 'vitest';
import {
  blankCommentsAndStrings,
  countStatements,
  findRiskyStatements,
  splitStatements,
} from './sql-scan.ts';

const severities = (sql: string): string[] => findRiskyStatements(sql).map((f) => f.severity);

describe('the expand allow-list', () => {
  it('passes typical additive DDL', () => {
    const sql = `
      CREATE TABLE k1_tenant (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        amount_minor bigint NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
        ratio numeric(12,2)
      );
      ALTER TABLE k1_tenant ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
      ALTER TABLE k1_tenant ADD COLUMN region text;
      ALTER TABLE k1_tenant ADD COLUMN status text NOT NULL DEFAULT 'active';
      ALTER TABLE k1_tenant ADD COLUMN slug text GENERATED ALWAYS AS (lower(name)) STORED NOT NULL;
      ALTER TABLE k1_tenant ALTER COLUMN region DROP NOT NULL;
      ALTER TABLE k1_tenant ADD CONSTRAINT k1_tenant_name_len CHECK (length(name) <= 200) NOT VALID;
      ALTER TABLE k1_tenant VALIDATE CONSTRAINT k1_tenant_name_len;
      CREATE INDEX k1_tenant_region_idx ON k1_tenant (region);
      CREATE TYPE k1_status AS ENUM ('active');
      ALTER TYPE k1_status ADD VALUE 'suspended';
      CREATE FUNCTION k1_touch() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;
      COMMENT ON TABLE k1_tenant IS 'tenants';
      GRANT SELECT, INSERT ON k1_tenant TO gx_app;
      INSERT INTO k1_status_label (code) VALUES ('active');
    `;
    expect(findRiskyStatements(sql)).toEqual([]);
  });

  it('lets a migration shape a table it creates in the same file', () => {
    const sql =
      'CREATE TABLE k1_t (a int);\nALTER TABLE k1_t ADD COLUMN b int NOT NULL, ADD CONSTRAINT k1_t_b CHECK (b > 0), DROP COLUMN a;';
    expect(findRiskyStatements(sql)).toEqual([]);
  });

  it('keeps quoted table names distinct: shaping a new "a" does not free an old "b"', () => {
    expect(severities('CREATE TABLE "a" (id int);\nALTER TABLE "b" DROP COLUMN c;')).toEqual([
      'contract',
    ]);
  });
});

describe('re-review findings', () => {
  it('flags a view without security_invoker, which can read across tenants', () => {
    expect(severities('CREATE VIEW k1_v AS SELECT * FROM k1_tenant;')).toEqual(['security']);
    expect(severities('CREATE OR REPLACE VIEW k1_v AS SELECT * FROM k1_tenant;')).toEqual([
      'security',
    ]);
  });

  it('accepts a security_invoker view, and a replaced one is still contract', () => {
    expect(
      findRiskyStatements('CREATE VIEW k1_v WITH (security_invoker = true) AS SELECT 1;'),
    ).toEqual([]);
    expect(
      severities('CREATE OR REPLACE VIEW k1_v WITH (security_invoker = on) AS SELECT 1;'),
    ).toEqual(['contract']);
  });

  it('flags replacing a function that policies may call', () => {
    const sql =
      'CREATE OR REPLACE FUNCTION k1_current_tenant() RETURNS uuid AS $$ SELECT NULL::uuid $$ LANGUAGE sql;';
    expect(severities(sql)).toEqual(['security']);
  });

  it('flags a blocking index on an existing table, but not CONCURRENTLY or on a new table', () => {
    expect(severities('CREATE INDEX k1_t_c ON k1_t (c);')).toEqual(['contract']);
    expect(findRiskyStatements('CREATE INDEX CONCURRENTLY k1_t_c ON k1_t (c);')).toEqual([]);
    expect(
      findRiskyStatements('CREATE TABLE k1_n (c int);\nCREATE UNIQUE INDEX k1_n_c ON k1_n (c);'),
    ).toEqual([]);
  });

  it('flags upserts and INSERT ... SELECT, not plain seed inserts', () => {
    expect(
      severities('INSERT INTO k1_t (id) VALUES (1) ON CONFLICT (id) DO UPDATE SET id = 2;'),
    ).toEqual(['contract']);
    expect(severities('INSERT INTO k1_t SELECT * FROM k1_old;')).toEqual(['contract']);
    expect(findRiskyStatements('INSERT INTO k1_t (id) VALUES (1) ON CONFLICT DO NOTHING;')).toEqual(
      [],
    );
  });

  it('flags materialized views and turning security_invoker off', () => {
    expect(severities('CREATE MATERIALIZED VIEW k1_mv AS SELECT * FROM k1_tenant;')).toEqual([
      'security',
    ]);
    expect(severities('ALTER VIEW k1_v SET (security_invoker = false);')).toEqual(['security']);
  });

  it('treats ON n(x) with no space as the same new table', () => {
    expect(
      findRiskyStatements('CREATE TABLE k1_n (x int);\nCREATE INDEX k1_n_x ON k1_n(x);'),
    ).toEqual([]);
  });

  it('accepts a grant to the quoted app role', () => {
    expect(findRiskyStatements('GRANT SELECT ON k1_t TO "gx_app";')).toEqual([]);
  });
});

describe('contract statements', () => {
  it.each([
    ['drop table', 'DROP TABLE k1_old;'],
    ['drop column', 'ALTER TABLE k1_t DROP COLUMN legacy;'],
    ['drop default', 'ALTER TABLE k1_t ALTER COLUMN c DROP DEFAULT;'],
    ['rename column', 'ALTER TABLE k1_t RENAME COLUMN a TO b;'],
    ['rename table', 'ALTER TABLE k1_t RENAME TO k1_u;'],
    ['rename enum value', "ALTER TYPE k1_status RENAME VALUE 'a' TO 'b';"],
    ['type change', 'ALTER TABLE k1_t ALTER COLUMN c TYPE bigint;'],
    ['set data type', 'ALTER TABLE k1_t ALTER COLUMN c SET DATA TYPE text;'],
    ['set not null', 'ALTER TABLE k1_t ALTER COLUMN c SET NOT NULL;'],
    ['not null without default', 'ALTER TABLE k1_t ADD COLUMN c text NOT NULL;'],
    ['constraint on an existing table', 'ALTER TABLE k1_t ADD CONSTRAINT k1_c CHECK (c > 0);'],
    [
      'foreign key on an existing table',
      'ALTER TABLE k1_t ADD FOREIGN KEY (p) REFERENCES k1_p (id);',
    ],
    ['set schema', 'ALTER TABLE k1_t SET SCHEMA archive;'],
    ['set unlogged', 'ALTER TABLE k1_t SET UNLOGGED;'],
    ['detach partition', 'ALTER TABLE k1_t DETACH PARTITION k1_t_2025;'],
    ['sequence restart', 'ALTER SEQUENCE k1_seq RESTART WITH 1;'],
    ['revoke on a table', 'REVOKE SELECT ON k1_t FROM gx_app;'],
    ['update', 'UPDATE k1_t SET c = 1;'],
    ['update a quoted table', 'UPDATE "k1_t" SET c = 1;'],
    ['update with alias', 'UPDATE k1_t AS t SET c = 1;'],
    ['update only', 'UPDATE ONLY k1_t SET c = 1;'],
    ['update in a CTE', 'WITH x AS (SELECT 1) UPDATE k1_t SET c = 1;'],
    ['delete', 'DELETE FROM k1_t;'],
    ['truncate', 'TRUNCATE k1_t;'],
    ['merge', 'MERGE INTO k1_t USING k1_s ON true WHEN MATCHED THEN DELETE;'],
    ['an unlisted statement', 'SELECT k1_cleanup();'],
  ])('%s needs a contract migration', (_label, sql) => {
    expect(severities(sql)).toEqual(['contract']);
  });
});

describe('security statements (need gx:security-reviewed whatever the phase)', () => {
  it.each([
    ['disable RLS', 'ALTER TABLE k1_t DISABLE ROW LEVEL SECURITY;'],
    ['no force RLS', 'ALTER TABLE k1_t NO FORCE ROW LEVEL SECURITY;'],
    ['create policy', 'CREATE POLICY k1_all ON k1_t USING (true);'],
    ['alter policy', 'ALTER POLICY k1_iso ON k1_t USING (true);'],
    ['drop policy', 'DROP POLICY IF EXISTS k1_iso ON k1_t;'],
    ['bypassrls', 'ALTER ROLE gx_app BYPASSRLS;'],
    ['create role', 'CREATE ROLE gx_admin;'],
    [
      'security definer function',
      'CREATE FUNCTION k1_f() RETURNS int SECURITY DEFINER AS $$ SELECT 1 $$ LANGUAGE sql;',
    ],
    ['security definer via alter', 'ALTER FUNCTION k1_f() SECURITY DEFINER;'],
    ['set role', 'SET ROLE postgres;'],
    ['set session authorization', 'SET SESSION AUTHORIZATION postgres;'],
    ['DO block hiding a delete', 'DO $$ BEGIN DELETE FROM k1_t; END $$;'],
    ['DO block hiding dynamic SQL', "DO $$ BEGIN EXECUTE 'DROP TABLE k1_t'; END $$;"],
    ['owner change', 'ALTER TABLE k1_t OWNER TO postgres;'],
    ['default privileges', 'ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO public;'],
    ['grant to an unknown role', 'GRANT SELECT ON k1_t TO public;'],
    ['grant with grant option', 'GRANT SELECT ON k1_t TO gx_app WITH GRANT OPTION;'],
    ['role membership', 'GRANT postgres TO gx_app;'],
    ['schema-wide grant', 'GRANT ALL ON ALL TABLES IN SCHEMA public TO gx_app;'],
    ['extension', 'CREATE EXTENSION dblink;'],
  ])('%s', (_label, sql) => {
    expect(severities(sql)).toEqual(['security']);
  });
});

describe('forbidden transaction control', () => {
  it.each([
    'BEGIN',
    'START TRANSACTION',
    'COMMIT',
    'END',
    'ROLLBACK',
    'ABORT',
    'SAVEPOINT s',
    'RELEASE s',
    "PREPARE TRANSACTION 'x'",
  ])('%s', (statement) => {
    expect(severities(`CREATE TABLE k1_t (id int);\n${statement};`)).toEqual(['forbidden']);
  });

  it('does not mistake BEGIN and END inside a function body', () => {
    expect(
      findRiskyStatements(
        'CREATE FUNCTION k1_f() RETURNS void AS $$ BEGIN END $$ LANGUAGE plpgsql;',
      ),
    ).toEqual([]);
  });
});

describe('literal and comment handling', () => {
  it('reports the line of each finding', () => {
    const sql = 'CREATE TABLE k1_a (id int);\n\n-- note\nALTER TABLE k1_b\n  DROP COLUMN id;\n';
    expect(findRiskyStatements(sql).map(({ severity, line }) => ({ severity, line }))).toEqual([
      { severity: 'contract', line: 4 },
    ]);
  });

  it.each([
    ['line comment', '-- DROP TABLE k1_t;\nCREATE TABLE k1_u (id int);'],
    ['block comment', '/* DROP TABLE k1_t; */ CREATE TABLE k1_u (id int);'],
    [
      'nested block comment',
      '/* a /* DROP TABLE x; */ DELETE FROM y */ CREATE TABLE k1_u (id int);',
    ],
    ['string literal', "COMMENT ON TABLE k1_u IS 'do not DROP; or RENAME this';"],
    ['doubled quote', "COMMENT ON TABLE k1_u IS 'it''s fine; DROP nothing';"],
    [
      'dollar-quoted body',
      'CREATE FUNCTION k1_f() RETURNS void AS $$ BEGIN DELETE FROM k1_t; END $$ LANGUAGE plpgsql;',
    ],
    [
      'tagged dollar quote',
      'CREATE FUNCTION k1_g() RETURNS void AS $b$ TRUNCATE k1_t; $b$ LANGUAGE sql;',
    ],
    ['quoted identifier', 'CREATE TABLE "drop; table" (id int);'],
  ])('ignores keywords and semicolons inside a %s', (_label, sql) => {
    expect(findRiskyStatements(sql)).toEqual([]);
  });

  it("does not lose sync on E'\\'' escapes (review finding)", () => {
    const sql = "COMMENT ON TABLE k1_u IS E'it\\'s';\nDROP TABLE k1_t;";
    expect(severities(sql)).toEqual(['contract']);
  });

  it('does not read a $ inside an identifier as a dollar quote', () => {
    expect(severities('CREATE TABLE k1_a$b (id int);\nDROP TABLE k1_t;')).toEqual(['contract']);
  });

  it('keeps length and newlines so line numbers stay true', () => {
    const sql = "SELECT 'a\nb'; -- x\n/* y\n */ SELECT 1;";
    const blanked = blankCommentsAndStrings(sql);
    expect(blanked).toHaveLength(sql.length);
    expect(blanked.split('\n')).toHaveLength(sql.split('\n').length);
  });

  it('does not hang on an unterminated literal or comment', () => {
    expect(blankCommentsAndStrings("SELECT 'open").trim()).toBe('SELECT');
    expect(blankCommentsAndStrings('SELECT /* open').trim()).toBe('SELECT');
    expect(blankCommentsAndStrings('SELECT $$ open').trim()).toBe('SELECT');
  });
});

describe('splitStatements and countStatements', () => {
  it('splits at top-level semicolons only', () => {
    expect(splitStatements("SELECT ';';\n-- ;\nSELECT 2").map((s) => s.line)).toEqual([1, 3]);
    expect(countStatements('CREATE INDEX CONCURRENTLY k1_i ON k1_t (c)')).toBe(1);
    expect(countStatements('-- only a comment\n')).toBe(0);
  });
});
