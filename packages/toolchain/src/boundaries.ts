import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { scanRelations, type RelationAction } from '@gx/migrate';
import {
  checkImportGraph,
  loadRegister,
  TEST_FILE,
  toRepoPath,
  type Violation,
} from './import-graph.ts';
import { manifestSchema } from './manifest.ts';
import type { RegisterEntry } from './register.ts';

/**
 * The boundary lint: the import graph (`checkImportGraph`: no upward imports, no
 * cross-package internals, public API only) plus two rules about what foundation code
 * may contain:
 *
 * - `table-ownership`: a migration creates or changes only relations (tables, views,
 *   sequences) that start with its module's `table_prefix`, so ownership of data is
 *   readable from the name. A statement the lint cannot read is a violation, never skipped;
 * - `industry-word`: foundation packages know no industry; industry words live in packs,
 *   configuration and lookup data.
 *
 * Both apply to the registered packages under `packages/`. Packs are exempt only because
 * they are not in the register; when packs are registered, industry-word must be gated by
 * where a package lives and table-ownership must still apply (technical debt TD-18).
 */

/** The marker that lets one line keep an industry word. */
const WORD_LIST_MARKER = 'boundary:allow industry-word';
// boundary:allow industry-word this is the vocabulary the rule enforces
const VOCABULARY = 'solar epc photovoltaic inverter discom mnre kusum gst gstin hsn net-metering';
const INDUSTRY_WORDS = VOCABULARY.split(' ');
/**
 * A whole word, in any case, with an optional plural (`words`; a trailing number is not a
 * letter, so `word18` counts too). Identifiers are split into words first (see `spaceWords`), and `_` and `-` are
 * never letters, so `snake_case` and `kebab-case` need no help.
 */
const WORD_PATTERN = new RegExp(
  `(?<![a-z0-9])(${INDUSTRY_WORDS.map((word) => word.replace('-', '[ _-]?')).join('|')})(?:e?s)?(?![a-z])`,
  'i',
);
/** Line-comment leaders per file type; both languages also have block comments. */
const MARKER_LEADERS = { '//': String.raw`\/\/|\/\*`, '--': String.raw`--|\/\*` } as const;
type CommentToken = keyof typeof MARKER_LEADERS;
const markerPattern = (token: CommentToken): RegExp =>
  new RegExp(
    String.raw`(?:${MARKER_LEADERS[token]})[ \t]*boundary:allow industry-word(?:[ \t]+((?!\*\/)\S(?:(?!\*\/).)*?))?\s*(?:\*\/)?\s*$`,
  );
const MARKER_PATTERNS: Readonly<Record<CommentToken, RegExp>> = {
  '//': markerPattern('//'),
  '--': markerPattern('--'),
};

const MIGRATIONS_DIR = 'migrations';
const MANIFEST_FILE = 'manifest.json';
const SKIPPED_DIRS = new Set(['node_modules', 'dist']);
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
/** Data files under `src/` (lookup tables, seeds, fixtures that ship) are where industry words land. */
const DATA_EXTENSIONS = new Set(['.json', '.sql', '.md', '.yaml', '.yml', '.txt', '.csv']);

export interface BoundaryResult {
  readonly violations: readonly Violation[];
  readonly packagesChecked: number;
  readonly filesChecked: number;
}

export interface BoundaryOptions {
  /** Repository root: holds package.json and packages/register.json. */
  readonly root: string;
}

/** Runs the import-graph rules and the two boundary rules over every registered package. */
export function checkBoundaries(options: BoundaryOptions): BoundaryResult {
  const graph = checkImportGraph(options);
  const loaded = loadRegister(options.root);
  if (!loaded.ok) return graph;

  const violations: Violation[] = [...graph.violations];
  let filesChecked = graph.filesChecked;
  const scan = (file: string, token: CommentToken | undefined, dir: string): void => {
    filesChecked += 1;
    violations.push(
      ...industryWords(options.root, file, readFileSync(file, 'utf8'), token),
      ...industryWordsInPath(options.root, file, dir),
    );
  };

  for (const entry of loaded.register.packages) {
    const dir = join(options.root, entry.path);
    if (!existsSync(join(dir, 'package.json'))) continue; // reported by the import graph
    const manifest = readManifest(dir);
    for (const file of migrationFiles(dir)) {
      const text = readFileSync(file, 'utf8');
      violations.push(...tableOwnership(options.root, entry, manifest, file, text));
      scan(file, '--', dir);
    }
    for (const file of listTextFiles(join(dir, 'src'))) {
      const extension = extname(file);
      if (TEST_FILE.test(file)) continue;
      scan(
        file,
        CODE_EXTENSIONS.has(extension) ? '//' : extension === '.sql' ? '--' : undefined,
        dir,
      );
    }
    for (const name of [MANIFEST_FILE, 'package.json']) {
      const file = join(dir, name);
      if (existsSync(file)) scan(file, undefined, dir);
    }
  }
  return {
    violations: [...violations].sort(
      (a, b) =>
        (a.file ?? '').localeCompare(b.file ?? '') ||
        (a.line ?? 0) - (b.line ?? 0) ||
        a.rule.localeCompare(b.rule) ||
        a.message.localeCompare(b.message),
    ),
    packagesChecked: graph.packagesChecked,
    filesChecked,
  };
}

// ---------------------------------------------------------------- files

function migrationFiles(packageDir: string): string[] {
  const dir = join(packageDir, MIGRATIONS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => extname(name) === '.sql')
    .sort()
    .map((name) => join(dir, name));
}

/** Code and data files under a directory; build output and dependencies are skipped. */
function listTextFiles(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const files: string[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (!SKIPPED_DIRS.has(dirent.name)) files.push(...listTextFiles(path));
    } else if (dirent.isFile() && !dirent.name.endsWith('.d.ts')) {
      const extension = extname(dirent.name);
      if (CODE_EXTENSIONS.has(extension) || DATA_EXTENSIONS.has(extension)) files.push(path);
    }
  }
  return files.sort();
}

// ---------------------------------------------------------------- table ownership

type Manifest =
  | { readonly kind: 'ok'; readonly prefix: string | undefined }
  | { readonly kind: 'unreadable'; readonly why: string };

/** The module's table_prefix, read with the manifest schema's own rule for it. */
function readManifest(packageDir: string): Manifest {
  const path = join(packageDir, MANIFEST_FILE);
  if (!existsSync(path)) return { kind: 'ok', prefix: undefined };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { kind: 'unreadable', why: error instanceof Error ? error.message : String(error) };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { kind: 'unreadable', why: 'it is not a JSON object' };
  }
  const prefix: unknown = (raw as Record<string, unknown>)['table_prefix'];
  if (prefix === undefined) return { kind: 'ok', prefix: undefined };
  const parsed = manifestSchema.shape.table_prefix.safeParse(prefix);
  return parsed.success
    ? { kind: 'ok', prefix: parsed.data }
    : { kind: 'unreadable', why: `table_prefix ${JSON.stringify(prefix)} is not valid` };
}

const VERB: Readonly<Record<RelationAction, string>> = {
  create: 'creates',
  alter: 'alters',
  drop: 'drops',
  truncate: 'truncates',
  index: 'adds an index to',
  trigger: 'adds a trigger to',
  policy: 'changes a policy on',
  comment: 'comments on',
};

function tableOwnership(
  root: string,
  entry: RegisterEntry,
  manifest: Manifest,
  absolutePath: string,
  sql: string,
): Violation[] {
  const file = toRepoPath(root, absolutePath);
  const { changes, unreadable } = scanRelations(sql);
  const violations: Violation[] = unreadable.map((item) => ({
    rule: 'table-ownership',
    file,
    line: item.line,
    message: `${item.reason}; write it in a form the lint can read, so the owner of the relation is known`,
  }));
  const owned = changes.filter((change) => !change.temporary); // a TEMP relation belongs to no module
  if (owned.length > 0 && manifest.kind === 'unreadable') {
    violations.push({
      rule: 'table-ownership',
      file,
      message: `cannot check ownership: ${entry.path}/${MANIFEST_FILE} is unreadable (${manifest.why})`,
    });
    return violations;
  }
  const prefix = manifest.kind === 'ok' ? manifest.prefix : undefined;
  for (const change of owned) {
    const name = change.schema === undefined ? change.name : `${change.schema}.${change.name}`;
    const problem =
      prefix === undefined
        ? `but ${entry.id} declares no table_prefix in ${entry.path}/${MANIFEST_FILE}`
        : change.name.startsWith(prefix)
          ? undefined
          : `which does not start with ${entry.id}'s table_prefix ${prefix}`;
    if (problem !== undefined) {
      violations.push({
        rule: 'table-ownership',
        file,
        line: change.line,
        message: `${VERB[change.action]} ${name}, ${problem}`,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------- industry words

/** `fooBar`, `FooBar` and `HTTPServer` split into words (a plural acronym such as `APIs` stays whole); `foo_bar` and `foo-bar` already are. */
function spaceWords(line: string): string {
  return line.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z]{2,})/g, '$1 $2');
}

/** The first industry word in a piece of text, if any. */
function findIndustryWord(text: string): string | undefined {
  return WORD_PATTERN.exec(spaceWords(text))?.[1];
}

/** Whether the end of `prefix` is inside a string literal: a `//` there is text, not a comment. */
function insideString(prefix: string): boolean {
  let quote: string | undefined;
  for (let k = 0; k < prefix.length; k += 1) {
    const ch = prefix[k] ?? '';
    if (quote === undefined) {
      if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    } else if (ch === '\\') {
      k += 1;
    } else if (ch === quote) {
      quote = undefined;
    }
  }
  return quote !== undefined;
}

/** A file or folder name under the package is text too: `src/<word>/index.ts` leaks as well. */
function industryWordsInPath(root: string, absolutePath: string, packageDir: string): Violation[] {
  const inPackage = relative(packageDir, absolutePath).split(sep).join('/');
  const word = findIndustryWord(inPackage);
  if (word === undefined) return [];
  return [
    {
      rule: 'industry-word',
      file: toRepoPath(root, absolutePath),
      message: `the path ${inPackage} contains the industry word '${word}'; foundation code is industry-neutral`,
    },
  ];
}

interface Marker {
  readonly reason: string | undefined;
  /** Where the marker starts on its line. */
  readonly at: number;
  /** Nothing but the marker on its line: it covers the next line. Otherwise only its own. */
  readonly alone: boolean;
  used: boolean;
}

/**
 * Finds industry words line by line, comments included. A marker comment
 * `boundary:allow industry-word <reason>` allows the word on its own line when code comes
 * before it, or on the next line when it stands alone. The reason is required, only a real
 * comment counts (not the same characters inside a string, and not in JSON or Markdown),
 * and a marker that allows nothing is reported, so a stale one cannot linger.
 */
function industryWords(
  root: string,
  absolutePath: string,
  text: string,
  /** The line-comment token of the file type; data files have none, so they cannot carry a marker. */
  commentToken: CommentToken | undefined,
): Violation[] {
  const file = toRepoPath(root, absolutePath);
  const lines = text.split(/\r?\n/);
  const violations: Violation[] = [];
  const markers = new Map<number, Marker>();
  if (commentToken !== undefined) {
    lines.forEach((line, index) => {
      const match = MARKER_PATTERNS[commentToken].exec(line);
      if (match === null || insideString(line.slice(0, match.index))) return;
      markers.set(index, {
        reason: match[1],
        at: match.index,
        alone: line.slice(0, match.index).trim() === '',
        used: false,
      });
    });
  }

  lines.forEach((line, index) => {
    const own = markers.get(index);
    const aboveMarker = markers.get(index - 1);
    const above = aboveMarker?.alone === true ? aboveMarker : undefined;
    const word = findIndustryWord(own === undefined ? line : line.slice(0, own.at));
    if (word === undefined) return;
    const cover = [own, above].find((marker) => marker?.reason !== undefined);
    if (cover !== undefined) {
      cover.used = true;
      return;
    }
    violations.push({
      rule: 'industry-word',
      file,
      line: index + 1,
      message: `'${word}' is an industry word; foundation code is industry-neutral (move it to a pack or to configuration${commentToken === undefined ? '' : `, or add '${commentToken} ${WORD_LIST_MARKER} <reason>'`})`,
    });
  });

  for (const [index, marker] of markers) {
    if (marker.reason === undefined) {
      violations.push({
        rule: 'allow-marker',
        file,
        line: index + 1,
        message: `'${WORD_LIST_MARKER}' needs a reason after it`,
      });
    } else if (!marker.used) {
      violations.push({
        rule: 'allow-marker',
        file,
        line: index + 1,
        message: `'${WORD_LIST_MARKER}' allows nothing: no industry word on ${marker.alone ? 'the next line' : 'this line'}`,
      });
    }
  }
  return violations;
}
