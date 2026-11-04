/**
 * Static analysis of migration SQL. Comments and string literals (including dollar-quoted
 * bodies) are blanked out first, keeping every newline, so keywords inside them are not
 * matched and reported line numbers still point at the original file.
 */

export type StatementKind =
  | 'drop'
  | 'rename'
  | 'type-change'
  | 'set-not-null'
  | 'add-not-null-without-default'
  | 'delete'
  | 'truncate'
  | 'update'
  | 'transaction-control';

export interface Finding {
  readonly kind: StatementKind;
  readonly line: number;
  readonly text: string;
}

/** Replaces comments and literals with spaces of the same length; newlines are kept. */
export function blankCommentsAndStrings(sql: string): string {
  const out = sql.split('');
  const blank = (from: number, to: number): void => {
    for (let i = from; i < to && i < out.length; i += 1) if (out[i] !== '\n') out[i] = ' ';
  };
  let i = 0;
  while (i < sql.length) {
    const rest = sql.slice(i);
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      blank(i, stop);
      i = stop;
    } else if (rest.startsWith('/*')) {
      // Postgres block comments nest.
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
    } else if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j += 1;
      }
      blank(i, j + 1);
      i = j + 1;
    } else if (sql[i] === '"') {
      // Quoted identifiers are names, not keywords: blank them too.
      const end = sql.indexOf('"', i + 1);
      const stop = end === -1 ? sql.length : end + 1;
      blank(i, stop);
      i = stop;
    } else {
      const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest);
      if (dollar !== null) {
        const tag = dollar[0];
        const end = sql.indexOf(tag, i + tag.length);
        const stop = end === -1 ? sql.length : end + tag.length;
        blank(i, stop);
        i = stop;
      } else i += 1;
    }
  }
  return out.join('');
}

const RULES: readonly { readonly kind: StatementKind; readonly pattern: RegExp }[] = [
  // Relaxing NOT NULL is safe for the previous release; every other DROP is not.
  { kind: 'drop', pattern: /\bDROP\b(?!\s+NOT\s+NULL\b)/gi },
  { kind: 'rename', pattern: /\bRENAME\b/gi },
  { kind: 'type-change', pattern: /\bALTER\s+(?:COLUMN\s+)?\S+\s+(?:SET\s+DATA\s+)?TYPE\b/gi },
  { kind: 'set-not-null', pattern: /\bALTER\s+(?:COLUMN\s+)?\S+\s+SET\s+NOT\s+NULL\b/gi },
  { kind: 'delete', pattern: /\bDELETE\s+FROM\b/gi },
  { kind: 'truncate', pattern: /\bTRUNCATE\b/gi },
  { kind: 'update', pattern: /\bUPDATE\s+\S+\s+SET\b/gi },
  {
    kind: 'transaction-control',
    pattern: /(?:^|;)\s*(?:BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION|SAVEPOINT)\b/gi,
  },
];

const ADD_KEYWORD = /\bADD\b/gi;
/** `ADD` followed by one of these adds a constraint, not a column. */
const NOT_A_COLUMN = /^\s*(?:CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|EXCLUDE|VALUE)\b/i;

/** The clause from `start` to the next top-level comma or semicolon. */
function clauseFrom(code: string, start: number): string {
  let depth = 0;
  for (let i = start; i < code.length; i += 1) {
    const ch = code[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      if (depth === 0) return code.slice(start, i);
      depth -= 1;
    } else if ((ch === ',' || ch === ';') && depth === 0) return code.slice(start, i);
  }
  return code.slice(start);
}

/**
 * Finds the statements that break the previous release or destroy data. Each one is
 * allowed only in a migration marked `-- gx:phase contract` (transaction control never).
 */
export function findRiskyStatements(sql: string): Finding[] {
  const code = blankCommentsAndStrings(sql);
  const findings: Finding[] = [];
  const lineOf = (index: number): number => code.slice(0, index).split('\n').length;
  for (const { kind, pattern } of RULES) {
    for (const match of code.matchAll(pattern)) {
      const offset = kind === 'transaction-control' ? match[0].search(/[A-Za-z]/) : 0;
      const index = match.index + offset;
      findings.push({ kind, line: lineOf(index), text: oneLine(code.slice(index, index + 60)) });
    }
  }
  for (const match of code.matchAll(ADD_KEYWORD)) {
    const clause = clauseFrom(code, match.index + match[0].length);
    if (NOT_A_COLUMN.test(clause)) continue;
    // A column that gets a value on its own (default, generated, identity) is safe.
    if (/\bNOT\s+NULL\b/i.test(clause) && !/\b(?:DEFAULT|GENERATED)\b/i.test(clause)) {
      findings.push({
        kind: 'add-not-null-without-default',
        line: lineOf(match.index),
        text: oneLine(`ADD${clause}`),
      });
    }
  }
  return findings.sort((a, b) => a.line - b.line || a.kind.localeCompare(b.kind));
}

/** Number of statements, counted by semicolons outside comments and literals. */
export function countStatements(sql: string): number {
  return blankCommentsAndStrings(sql)
    .split(';')
    .filter((part) => part.trim() !== '').length;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
