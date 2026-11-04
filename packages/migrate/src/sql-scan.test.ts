import { describe, expect, it } from 'vitest';
import { blankCommentsAndStrings, countStatements, findRiskyStatements } from './sql-scan.ts';

const kinds = (sql: string): string[] => findRiskyStatements(sql).map((f) => f.kind);

describe('findRiskyStatements', () => {
  it('passes a typical expand migration', () => {
    const sql = `
      CREATE TABLE k1_tenant (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        amount_minor bigint NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
        ratio numeric(12,2),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE k1_tenant ADD COLUMN region text;
      ALTER TABLE k1_tenant ADD COLUMN status text NOT NULL DEFAULT 'active';
      ALTER TABLE k1_tenant ADD COLUMN slug text GENERATED ALWAYS AS (lower(name)) STORED NOT NULL;
      ALTER TABLE k1_tenant ALTER COLUMN region DROP NOT NULL;
      ALTER TABLE k1_tenant ADD CONSTRAINT k1_tenant_name_len CHECK (length(name) <= 200);
      CREATE INDEX k1_tenant_region_idx ON k1_tenant (region);
      CREATE TABLE k1_child (id uuid, tenant_id uuid REFERENCES k1_tenant (id) ON DELETE SET NULL ON UPDATE CASCADE);
    `;
    expect(findRiskyStatements(sql)).toEqual([]);
  });

  it.each([
    ['drop table', 'DROP TABLE k1_old;', 'drop'],
    ['drop column', 'ALTER TABLE k1_t DROP COLUMN legacy;', 'drop'],
    ['drop if exists', 'drop policy if exists p on k1_t;', 'drop'],
    ['drop default', 'ALTER TABLE k1_t ALTER COLUMN c DROP DEFAULT;', 'drop'],
    ['rename column', 'ALTER TABLE k1_t RENAME COLUMN a TO b;', 'rename'],
    ['rename table', 'ALTER TABLE k1_t RENAME TO k1_u;', 'rename'],
    ['type change', 'ALTER TABLE k1_t ALTER COLUMN c TYPE bigint;', 'type-change'],
    ['set data type', 'ALTER TABLE k1_t ALTER COLUMN c SET DATA TYPE text;', 'type-change'],
    ['set not null', 'ALTER TABLE k1_t ALTER COLUMN c SET NOT NULL;', 'set-not-null'],
    [
      'add not null without default',
      'ALTER TABLE k1_t ADD COLUMN c text NOT NULL;',
      'add-not-null-without-default',
    ],
    [
      'add not null after a check',
      'ALTER TABLE k1_t ADD c numeric(12,2) CHECK (c > 0) NOT NULL;',
      'add-not-null-without-default',
    ],
    ['delete', 'DELETE FROM k1_t WHERE true;', 'delete'],
    ['truncate', 'TRUNCATE k1_t;', 'truncate'],
    ['update backfill', 'UPDATE k1_t SET c = 1;', 'update'],
    ['begin', 'BEGIN;\nCREATE TABLE k1_t (id int);', 'transaction-control'],
    ['commit', 'CREATE TABLE k1_t (id int);\nCOMMIT;', 'transaction-control'],
  ])('flags %s', (_label, sql, kind) => {
    expect(kinds(sql)).toContain(kind);
  });

  it('reports the line of each finding', () => {
    const sql = 'CREATE TABLE k1_a (id int);\n\n-- note\nALTER TABLE k1_a\n  DROP COLUMN id;\n';
    const findings = findRiskyStatements(sql);
    expect(findings.map(({ kind, line }) => ({ kind, line }))).toEqual([{ kind: 'drop', line: 5 }]);
    expect(findings[0]?.text).toMatch(/^DROP COLUMN id/);
  });

  it.each([
    ['line comment', '-- DROP TABLE k1_t;\nCREATE TABLE k1_u (id int);'],
    ['block comment', '/* DROP TABLE k1_t; */ CREATE TABLE k1_u (id int);'],
    [
      'nested block comment',
      '/* outer /* DROP TABLE x; */ still comment DELETE FROM y */ SELECT 1;',
    ],
    ['string literal', "COMMENT ON TABLE k1_u IS 'do not DROP or RENAME this';"],
    ['escaped quote', "COMMENT ON TABLE k1_u IS 'it''s safe to DROP nothing';"],
    ['quoted identifier', 'CREATE TABLE "drop" (id int);'],
    [
      'dollar-quoted function body',
      'CREATE FUNCTION k1_f() RETURNS void AS $$ BEGIN DELETE FROM k1_t; END $$ LANGUAGE plpgsql;',
    ],
    [
      'tagged dollar quote',
      'CREATE FUNCTION k1_g() RETURNS void AS $body$ BEGIN TRUNCATE k1_t; END $body$ LANGUAGE plpgsql;',
    ],
  ])('ignores keywords inside a %s', (_label, sql) => {
    expect(findRiskyStatements(sql)).toEqual([]);
  });
});

describe('blankCommentsAndStrings', () => {
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

describe('countStatements', () => {
  it('counts statements, not semicolons in literals or comments', () => {
    expect(countStatements("SELECT ';'; -- ;\nSELECT 2;")).toBe(2);
    expect(countStatements('CREATE INDEX CONCURRENTLY k1_i ON k1_t (c)')).toBe(1);
    expect(countStatements('-- only a comment\n')).toBe(0);
  });
});
