/**
 * Static analysis of migration SQL by allow-list. The file is split into statements
 * (comments and literals blanked first, newlines kept, so lines stay true), and each
 * statement is classified by its head:
 *
 * - safe: additive DDL the previous release keeps working with;
 * - contract: removes, rewrites or tightens something, or is not on the allow-list;
 *   allowed only in a `gx:phase contract` migration;
 * - security: can weaken tenant isolation or privileges; allowed only with
 *   `gx:security-reviewed <reason>`, whatever the phase;
 * - forbidden: transaction control, which the runner owns.
 */

export type Severity = 'contract' | 'security' | 'forbidden';

export interface Finding {
  readonly severity: Severity;
  readonly line: number;
  /** Why this statement is not plain additive DDL. */
  readonly reason: string;
  readonly text: string;
}

/** Replaces comments and literals with spaces of the same length; newlines are kept. */
export function blankCommentsAndStrings(sql: string): string {
  const out = sql.split('');
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to && k < out.length; k += 1) if (out[k] !== '\n') out[k] = ' ';
  };
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const prev = i > 0 ? sql[i - 1] : '';
    if (sql.startsWith('--', i)) {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      blank(i, stop);
      i = stop;
    } else if (sql.startsWith('/*', i)) {
      let depth = 0;
      let j = i;
      while (j < sql.length) {
        if (sql.startsWith('/*', j)) {
          depth += 1;
          j += 2;
        } else if (sql.startsWith('*/', j)) {
          depth -= 1;
          j += 2;
          if (depth === 0) break;
        } else j += 1;
      }
      blank(i, j);
      i = j;
    } else if (ch === "'") {
      // E'...' strings use backslash escapes; standard strings double the quote.
      const escapes =
        /[eE]/.test(prev ?? '') && !/[A-Za-z0-9_]/.test(i > 1 ? (sql[i - 2] ?? '') : '');
      let j = i + 1;
      while (j < sql.length) {
        if (escapes && sql[j] === '\\') j += 2;
        else if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j += 1;
      }
      blank(escapes ? i - 1 : i, j + 1);
      i = j + 1;
    } else if (ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '"' && sql[j + 1] === '"') j += 2;
        else if (sql[j] === '"') break;
        else j += 1;
      }
      // Quoted identifiers are names, not keywords. Keep their letters, wrapped as q...q and
      // with other characters as _, so names stay distinct but can never match a keyword.
      for (let k = i; k <= j && k < out.length; k += 1) {
        const c = sql[k] ?? '';
        out[k] = k === i || k === j ? 'q' : c === '\n' ? '\n' : /[A-Za-z0-9_]/.test(c) ? c : '_';
      }
      i = j + 1;
    } else if (ch === '$' && !/[A-Za-z0-9_$]/.test(prev ?? '')) {
      const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (tag === null) {
        i += 1;
        continue;
      }
      const end = sql.indexOf(tag[0], i + tag[0].length);
      const stop = end === -1 ? sql.length : end + tag[0].length;
      blank(i, stop);
      i = stop;
    } else i += 1;
  }
  return out.join('');
}

export interface Statement {
  /** The statement with comments and literals blanked, whitespace collapsed, upper-cased. */
  readonly code: string;
  readonly line: number;
}

/** Statements at top-level semicolons; empty statements are dropped. */
export function splitStatements(sql: string): Statement[] {
  const code = blankCommentsAndStrings(sql);
  const statements: Statement[] = [];
  let start = 0;
  for (let i = 0; i <= code.length; i += 1) {
    if (i === code.length || code[i] === ';') {
      const raw = code.slice(start, i);
      const offset = raw.search(/\S/);
      if (offset !== -1) {
        statements.push({
          code: raw.replace(/\s+/g, ' ').trim().toUpperCase(),
          line: code.slice(0, start + offset).split('\n').length,
        });
      }
      start = i + 1;
    }
  }
  return statements;
}

export function countStatements(sql: string): number {
  return splitStatements(sql).length;
}

/** Roles a migration may grant to without a security review. */
export const KNOWN_ROLES: readonly string[] = ['GX_APP'];
/** The same roles written as quoted identifiers, as the blanker leaves them (q...q). */
const KNOWN_ROLES_QUOTED: readonly string[] = KNOWN_ROLES.map((role) => `Q${role}Q`);

const TRANSACTION_CONTROL =
  /^(?:BEGIN|START|COMMIT|END|ROLLBACK|ABORT|SAVEPOINT|RELEASE|PREPARE TRANSACTION|COMMIT PREPARED|ROLLBACK PREPARED)\b/;
const SECURITY_ANYWHERE: readonly [RegExp, string][] = [
  [/\bSECURITY DEFINER\b/, 'SECURITY DEFINER runs with the owner’s privileges'],
  [/\bBYPASSRLS\b/, 'BYPASSRLS lets a role ignore row-level security'],
  [/\b(?:DISABLE|NO FORCE) ROW LEVEL SECURITY\b/, 'this switches off row-level security'],
  [/\bOWNER TO\b/, 'changing an owner changes who bypasses row-level security'],
];
const SECURITY_HEADS: readonly [RegExp, string][] = [
  [/^DO\b/, 'a DO block can run any statement, so it is not checked'],
  [/^(?:CREATE|ALTER|DROP) POLICY\b/, 'row-level security policies decide tenant isolation'],
  [/^(?:CREATE|ALTER|DROP) (?:ROLE|USER|GROUP)\b/, 'role changes affect every privilege'],
  [/^ALTER DEFAULT PRIVILEGES\b/, 'default privileges apply to future tables'],
  [
    /^SET (?:SESSION )?(?:ROLE|SESSION AUTHORIZATION)\b/,
    'switching role changes who owns what this creates',
  ],
  [/^(?:CREATE|ALTER|DROP) EXTENSION\b/, 'extensions run privileged code'],
  [/^(?:REVOKE|GRANT)\b.*\bON (?:SCHEMA|DATABASE|ALL)\b/, 'schema- and database-wide privileges'],
  [/^SECURITY LABEL\b/, 'security labels'],
  [
    /^CREATE MATERIALIZED VIEW\b/,
    'a materialized view stores rows with its owner’s rights, outside row-level security',
  ],
  [
    /^ALTER VIEW\b.*\bSECURITY_INVOKER\s*=\s*(?:FALSE|OFF|0)\b/,
    'turning off security_invoker makes the view bypass row-level security',
  ],
];
const SAFE_HEADS: readonly RegExp[] = [
  /^CREATE (?:UNLOGGED )?TABLE\b/,
  /^CREATE (?:TYPE|SEQUENCE|SCHEMA|DOMAIN)\b/,
  /^CREATE (?:FUNCTION|PROCEDURE|TRIGGER)\b/,
  /^CREATE CONSTRAINT TRIGGER\b/,
  /^COMMENT ON\b/,
  /^ALTER TYPE \S+ ADD VALUE\b/,
];

/** One ALTER TABLE action, judged on its own. */
function judgeAlterTableAction(action: string, tableIsNew: boolean): string | undefined {
  const a = action.trim();
  if (
    /^ADD (?:COLUMN )?(?:IF NOT EXISTS )?(?!CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|EXCLUDE)\S+/.test(
      a,
    )
  ) {
    if (/\bNOT NULL\b/.test(a) && !/\b(?:DEFAULT|GENERATED)\b/.test(a) && !tableIsNew) {
      return 'a NOT NULL column without a default breaks writers of the previous release';
    }
    return undefined;
  }
  if (/^ADD (?:CONSTRAINT \S+ )?(?:PRIMARY|FOREIGN|UNIQUE|CHECK|EXCLUDE)\b/.test(a)) {
    if (tableIsNew || /\bNOT VALID\b/.test(a)) return undefined;
    return 'a new constraint on an existing table checks old rows and old writers; add it NOT VALID, then VALIDATE';
  }
  if (/^VALIDATE CONSTRAINT\b/.test(a)) return undefined;
  if (/^(?:ENABLE|FORCE) ROW LEVEL SECURITY\b/.test(a)) return undefined;
  if (/^ALTER (?:COLUMN )?\S+ (?:DROP NOT NULL|SET DEFAULT\b|SET STATISTICS\b)/.test(a))
    return undefined;
  if (tableIsNew) return undefined;
  if (/^(?:ALTER (?:COLUMN )?\S+ )?(?:SET DATA )?TYPE\b/.test(a))
    return 'a column type change can break the previous release';
  if (/\bSET NOT NULL\b/.test(a)) return 'SET NOT NULL breaks writers of the previous release';
  if (/^DROP\b/.test(a) || /\bDROP\b/.test(a))
    return 'DROP removes something the previous release may still use';
  if (/^RENAME\b/.test(a))
    return 'RENAME breaks the previous release; add the new name, copy, then drop later';
  return 'this ALTER TABLE action is not on the expand allow-list';
}

/** Top-level comma-separated parts of an ALTER TABLE action list. */
function splitActions(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

const tableNameOf = (name: string): string =>
  name
    .replace(/^ONLY /, '')
    .replace(/^IF (?:NOT )?EXISTS /, '')
    .split(' ')[0] ?? '';

/** Every statement that is not plain additive DDL, with its line and why. */
export function findRiskyStatements(sql: string): Finding[] {
  const findings: Finding[] = [];
  const createdTables = new Set<string>();
  const add = (severity: Severity, statement: Statement, reason: string): void => {
    findings.push({ severity, line: statement.line, reason, text: statement.code.slice(0, 80) });
  };

  for (const statement of splitStatements(sql)) {
    const { code } = statement;
    const created = /^CREATE (?:UNLOGGED )?TABLE (?:IF NOT EXISTS )?(\S+)/.exec(code);
    if (created?.[1] !== undefined) createdTables.add(created[1]);

    if (TRANSACTION_CONTROL.test(code)) {
      add(
        'forbidden',
        statement,
        'the runner owns transactions; remove BEGIN, COMMIT, END, ROLLBACK, ABORT, SAVEPOINT or RELEASE',
      );
      continue;
    }
    const security =
      SECURITY_HEADS.find(([pattern]) => pattern.test(code)) ??
      SECURITY_ANYWHERE.find(([pattern]) => pattern.test(code));
    if (security !== undefined) {
      add('security', statement, security[1]);
      continue;
    }
    if (/^GRANT\b/.test(code) && !/\bON\b/.test(code)) {
      add('security', statement, 'granting a role to a role is privilege escalation');
      continue;
    }
    const grant = /^GRANT\b.*\bTO (.+)$/.exec(code);
    if (grant?.[1] !== undefined) {
      const roles = grant[1]
        .replace(/\bWITH GRANT OPTION\b/, '')
        .split(',')
        .map((r) => r.trim());
      const known = (role: string): boolean =>
        KNOWN_ROLES.includes(role) || KNOWN_ROLES_QUOTED.includes(role);
      if (/\bWITH GRANT OPTION\b/.test(code) || roles.some((role) => !known(role))) {
        add('security', statement, `GRANT to a role other than ${KNOWN_ROLES.join(', ')}`);
      }
      continue;
    }
    const alterTable =
      /^ALTER TABLE (.+?) ((?:ADD|ALTER|DROP|RENAME|VALIDATE|ENABLE|FORCE|DISABLE|NO|SET|RESET|ATTACH|DETACH|OWNER|INHERIT|CLUSTER|REPLICA|OF|NOT)\b.*)$/.exec(
        code,
      );
    if (alterTable?.[1] !== undefined && alterTable[2] !== undefined) {
      const tableIsNew = createdTables.has(tableNameOf(alterTable[1]));
      for (const action of splitActions(alterTable[2])) {
        const reason = judgeAlterTableAction(action, tableIsNew);
        if (reason !== undefined) add('contract', statement, reason);
      }
      continue;
    }
    if (/^CREATE (?:OR REPLACE )?(?:TEMP |TEMPORARY )?(?:RECURSIVE )?VIEW\b/.test(code)) {
      if (!/\bSECURITY_INVOKER\s*=\s*(?:TRUE|ON|1)\b/.test(code)) {
        add(
          'security',
          statement,
          'a view runs with its owner’s rights and can bypass row-level security; create it WITH (security_invoker = true)',
        );
      } else if (/^CREATE OR REPLACE\b/.test(code)) {
        add('contract', statement, 'replacing a view changes what the previous release reads');
      }
      continue;
    }
    if (/^CREATE OR REPLACE (?:FUNCTION|PROCEDURE|TRIGGER)\b/.test(code)) {
      add(
        'security',
        statement,
        'replacing a function can change behaviour that policies and other code rely on',
      );
      continue;
    }
    const index =
      /^CREATE (?:UNIQUE )?INDEX (CONCURRENTLY )?(?:IF NOT EXISTS )?(?:\S+ )?ON (?:ONLY )?([^\s(]+)/.exec(
        code,
      );
    if (index !== null) {
      if (index[1] === undefined && !createdTables.has(index[2] ?? '')) {
        add(
          'contract',
          statement,
          'a plain CREATE INDEX on an existing table blocks writes; use CONCURRENTLY in a gx:no-transaction migration',
        );
      }
      continue;
    }
    if (/^INSERT INTO\b/.test(code)) {
      if (/\bON CONFLICT\b.*\bDO UPDATE\b/.test(code) || /\bSELECT\b/.test(code)) {
        add(
          'contract',
          statement,
          'INSERT ... SELECT and upserts rewrite or copy data; run them as jobs or in a contract migration',
        );
      }
      continue;
    }
    if (SAFE_HEADS.some((pattern) => pattern.test(code))) continue;
    add('contract', statement, describeUnlisted(code));
  }
  return findings;
}

function describeUnlisted(code: string): string {
  if (/^(?:WITH\b.*\b)?(?:UPDATE|DELETE|MERGE)\b/.test(code) || /^(?:TRUNCATE|COPY)\b/.test(code)) {
    return 'this rewrites or removes data; backfills and clean-ups run as tenant-aware jobs';
  }
  if (/^DROP\b/.test(code)) return 'DROP removes something the previous release may still use';
  if (/\bRENAME\b/.test(code)) return 'RENAME breaks the previous release';
  return 'this statement is not on the expand allow-list';
}

/** What a statement does to a relation (table, view, materialised view, sequence or foreign table). */
export type RelationAction =
  'create' | 'alter' | 'drop' | 'truncate' | 'index' | 'trigger' | 'policy' | 'comment';

export interface RelationChange {
  readonly action: RelationAction;
  /** Lower-cased when unquoted (Postgres folds it); as written when quoted. */
  readonly name: string;
  /** The schema it is named in, when the statement names one. */
  readonly schema?: string;
  readonly line: number;
  /** A `TEMP` relation lives only for the session, so it belongs to no module. */
  readonly temporary: boolean;
}

/** A statement that changes relations but whose target this scan could not read. */
export interface UnreadableRelation {
  readonly line: number;
  readonly reason: string;
}

export interface RelationScan {
  readonly changes: readonly RelationChange[];
  readonly unreadable: readonly UnreadableRelation[];
}

const BARE = String.raw`(?:[A-Za-z_]|[^\x00-\x7F])(?:[A-Za-z0-9_$]|[^\x00-\x7F])*`;
/** `q...q` is how the blanker leaves a quoted name; the original text decides which it was. */
const NAME = String.raw`(?:q[A-Za-z0-9_]*q|${BARE})`;
const DOTTED = String.raw`${NAME}(?:\s*\.\s*${NAME})*`;
const DOTTED_LIST = String.raw`${DOTTED}(?:\s*,\s*${DOTTED})*`;
const KIND = String.raw`(?:TABLE|VIEW|MATERIALIZED\s+VIEW|SEQUENCE|FOREIGN\s+TABLE)`;
const IF_NOT_EXISTS = String.raw`(?:IF\s+NOT\s+EXISTS\s+)?`;
const IF_EXISTS = String.raw`(?:IF\s+EXISTS\s+)?`;

interface Rule {
  readonly action: RelationAction;
  readonly pattern: RegExp;
  /** The named group holds a comma-separated list rather than one name. */
  readonly list?: true;
  /** The named group ends with a column: drop it to get the relation. */
  readonly column?: true;
}

const rule = (action: RelationAction, source: string, extra: Partial<Rule> = {}): Rule => ({
  action,
  pattern: new RegExp(source, 'id'),
  ...extra,
});

const RULES: readonly Rule[] = [
  rule(
    'create',
    String.raw`^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:(?:GLOBAL\s+|LOCAL\s+)?(?<temp>TEMPORARY|TEMP)\s+|UNLOGGED\s+)?(?:RECURSIVE\s+)?${KIND}\s+${IF_NOT_EXISTS}(?<name>${DOTTED})`,
  ),
  rule(
    'create',
    String.raw`^\s*SELECT\b[\s\S]*?\bINTO\s+(?:(?<temp>TEMPORARY|TEMP)\s+|UNLOGGED\s+)?(?:TABLE\s+)?(?<name>${DOTTED})`,
  ),
  rule(
    'alter',
    String.raw`^\s*ALTER\s+${KIND}\s+${IF_EXISTS}(?:ONLY\s+)?(?<name>${DOTTED})(?:\s+RENAME\s+TO\s+(?<to>${NAME}))?`,
  ),
  rule('drop', String.raw`^\s*DROP\s+${KIND}\s+${IF_EXISTS}(?<name>${DOTTED_LIST})`, {
    list: true,
  }),
  rule('truncate', String.raw`^\s*TRUNCATE\s+(?:TABLE\s+)?(?:ONLY\s+)?(?<name>${DOTTED_LIST})`, {
    list: true,
  }),
  rule(
    'index',
    String.raw`^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?${IF_NOT_EXISTS}(?:${NAME}\s+)?ON\s+(?:ONLY\s+)?(?<name>${DOTTED})`,
  ),
  rule(
    'trigger',
    String.raw`^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+${NAME}[\s\S]*?\sON\s+(?<name>${DOTTED})`,
  ),
  rule('policy', String.raw`^\s*(?:CREATE|ALTER)\s+POLICY\s+${NAME}\s+ON\s+(?<name>${DOTTED})`),
  rule('policy', String.raw`^\s*DROP\s+POLICY\s+${IF_EXISTS}${NAME}\s+ON\s+(?<name>${DOTTED})`),
  rule('comment', String.raw`^\s*COMMENT\s+ON\s+${KIND}\s+(?<name>${DOTTED})`),
  rule('comment', String.raw`^\s*COMMENT\s+ON\s+COLUMN\s+(?<name>${DOTTED})`, { column: true }),
];

/** A statement that starts like a relation statement; if no rule read it, it is unreadable. */
const RELATION_HEAD = new RegExp(
  String.raw`^\s*(?:(?:CREATE|ALTER|DROP)\s+(?:OR\s+REPLACE\s+)?(?:(?:GLOBAL|LOCAL|TEMPORARY|TEMP|UNLOGGED|RECURSIVE|UNIQUE|CONSTRAINT|FOREIGN|MATERIALIZED)\s+)*(?:TABLE|VIEW|SEQUENCE|INDEX|TRIGGER|POLICY)\b|COMMENT\s+ON\s+(?:TABLE|VIEW|MATERIALIZED|SEQUENCE|FOREIGN|COLUMN)\b|TRUNCATE\b)`,
  'i',
);
/** `CREATE SCHEMA x CREATE TABLE ...` declares relations inside one statement. */
const SCHEMA_WITH_ELEMENTS = /^\s*CREATE\s+SCHEMA\b[\s\S]*?\sCREATE\s/i;

/**
 * Every relation a migration creates, alters, drops, indexes, triggers, polices or
 * comments on: tables, views, materialised views, sequences and foreign tables, in every
 * form of those statements, with `RENAME TO` read both ways (the old name is altered, the
 * new one is created) and `SELECT ... INTO`. Comments and literals are blanked first, so a
 * name that appears only in a comment or string does not count. A relation `TEMP`-created
 * earlier in the same file is temporary for its later statements too.
 *
 * A statement that starts like one of these but whose target cannot be read (including
 * `CREATE SCHEMA ... CREATE ...`) is returned as unreadable, never skipped. Not seen:
 * relations made inside `DO` blocks or `EXECUTE` strings, which the allow-list scan sends
 * to review as non-additive; `GRANT` and `REVOKE`, which are security-reviewed anyway.
 */
export function scanRelations(sql: string): RelationScan {
  const code = blankCommentsAndStrings(sql);
  const changes: RelationChange[] = [];
  const unreadable: UnreadableRelation[] = [];
  const temporaries = new Set<string>();
  let start = 0;
  for (let i = 0; i <= code.length; i += 1) {
    if (i !== code.length && code[i] !== ';') continue;
    const raw = code.slice(start, i);
    const offset = raw.search(/\S/);
    if (offset !== -1) {
      const line = code.slice(0, start + offset).split('\n').length;
      const read = readStatement(sql, raw, start, line, temporaries);
      changes.push(...read);
      if (read.length === 0) {
        if (SCHEMA_WITH_ELEMENTS.test(raw)) {
          unreadable.push({ line, reason: 'CREATE SCHEMA with objects inside it' });
        } else if (RELATION_HEAD.test(raw)) {
          unreadable.push({ line, reason: 'the relation this statement changes cannot be read' });
        }
      }
    }
    start = i + 1;
  }
  return { changes, unreadable };
}

function readStatement(
  sql: string,
  raw: string,
  base: number,
  line: number,
  temporaries: Set<string>,
): RelationChange[] {
  const found: RelationChange[] = [];
  for (const { action, pattern, list, column } of RULES) {
    const match = pattern.exec(raw);
    const span = match?.indices?.groups?.['name'];
    if (match === null || span === undefined) continue;
    const temp = match.groups?.['temp'] !== undefined;
    const spans = list === true ? splitList(raw, span) : [span];
    for (const [from, to] of spans) {
      const parts = nameParts(sql, raw, base, from, to);
      if (column === true) parts.pop();
      const name = parts.pop();
      if (name === undefined) continue;
      const schema = parts.pop();
      const isTemp = temp || (action !== 'create' && schema === undefined && temporaries.has(name));
      if (action === 'create' && temp) temporaries.add(name);
      found.push({
        action,
        name,
        ...(schema === undefined ? {} : { schema }),
        line,
        temporary: isTemp,
      });
    }
    const renamedTo = match.indices?.groups?.['to'];
    if (renamedTo !== undefined) {
      const [renamed] = nameParts(sql, raw, base, renamedTo[0], renamedTo[1]);
      const old = found[found.length - 1];
      if (renamed !== undefined && old !== undefined) {
        found.push({
          action: 'create',
          name: renamed,
          ...(old.schema === undefined ? {} : { schema: old.schema }),
          line,
          temporary: old.temporary,
        });
      }
    }
    return found; // the first rule that reads the statement owns it
  }
  return found;
}

/** Splits a span at top-level commas (quoted names hold none: the blanker removed them). */
function splitList(raw: string, [from, to]: readonly [number, number]): [number, number][] {
  const spans: [number, number][] = [];
  let begin = from;
  for (let k = from; k <= to; k += 1) {
    if (k === to || raw[k] === ',') {
      spans.push([begin, k]);
      begin = k + 1;
    }
  }
  return spans;
}

/**
 * The parts of a dotted name, in order. A part was quoted if the original text has a double
 * quote there: it keeps its case and its `""`; otherwise it folds to lower case.
 */
function nameParts(sql: string, raw: string, base: number, from: number, to: number): string[] {
  const parts: string[] = [];
  let begin = from;
  for (let k = from; k <= to; k += 1) {
    if (k !== to && raw[k] !== '.') continue;
    const text = raw.slice(begin, k);
    const lead = text.length - text.trimStart().length;
    const trimmed = text.trim();
    const at = base + begin + lead;
    if (trimmed.length > 0) {
      parts.push(
        sql[at] === '"'
          ? sql.slice(at + 1, at + trimmed.length - 1).replace(/""/g, '"')
          : trimmed.toLowerCase(),
      );
    }
    begin = k + 1;
  }
  return parts;
}
