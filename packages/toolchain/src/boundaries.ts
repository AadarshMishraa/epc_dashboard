import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { findCreatedTables } from '@gx/migrate';
import { z } from 'zod';
import {
  checkImportGraph,
  listSourceFiles,
  loadRegister,
  TEST_FILE,
  toRepoPath,
  type Violation,
} from './import-graph.ts';
import type { RegisterEntry } from './register.ts';

/**
 * The boundary lint: the import graph (`checkImportGraph`: no upward imports, no
 * cross-package internals, public API only) plus two rules about what foundation code
 * may contain:
 *
 * - `table-ownership`: a migration creates only tables that start with its module's
 *   `table_prefix`, so ownership of data is readable from the name;
 * - `industry-word`: foundation packages know no industry; industry words live in packs,
 *   configuration and lookup data.
 *
 * Both apply to `packages/` only, never to `packs/`.
 */

/** The marker that lets one line keep an industry word. Comments are scanned too, so prose cannot leak either. */
const WORD_LIST_MARKER = 'boundary:allow industry-word';
// boundary:allow industry-word this is the vocabulary the rule enforces
const VOCABULARY = 'solar epc photovoltaic inverter discom mnre kusum gst gstin hsn net-metering';
const INDUSTRY_WORDS = VOCABULARY.split(' ');
/** Words in `snake_case`, `kebab-case` and `camelCase` identifiers count as separate words. */
const WORD_PATTERN = new RegExp(
  `(?<![a-z0-9])(${INDUSTRY_WORDS.map((word) => word.replace('-', '[ -]')).join('|')})(?![a-z0-9])`,
  'i',
);
/** Only a comment counts as a marker, so the words 'boundary:allow industry-word' in a string do not. */
const MARKER_PATTERN =
  /(?:\/\/|--|\/\*)[ \t]*boundary:allow industry-word(?:[ \t]+(\S.*?))?\s*(?:\*\/)?\s*$/;
const MIGRATIONS_DIR = 'migrations';
const MANIFEST_FILE = 'manifest.json';

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
  for (const entry of loaded.register.packages) {
    const dir = join(options.root, entry.path);
    if (!existsSync(join(dir, 'package.json'))) continue; // reported by the import graph
    const prefix = readTablePrefix(dir);
    for (const file of migrationFiles(dir)) {
      filesChecked += 1;
      const text = readFileSync(file, 'utf8');
      violations.push(...tableOwnership(options.root, entry, prefix, file, text));
      violations.push(...industryWords(options.root, file, text, '--'));
    }
    for (const file of listSourceFiles(join(dir, 'src'))) {
      if (TEST_FILE.test(file)) continue;
      filesChecked += 1;
      violations.push(...industryWords(options.root, file, readFileSync(file, 'utf8'), '//'));
    }
    const manifest = join(dir, MANIFEST_FILE);
    if (existsSync(manifest)) {
      filesChecked += 1;
      violations.push(
        ...industryWords(options.root, manifest, readFileSync(manifest, 'utf8'), undefined),
      );
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

// ---------------------------------------------------------------- table ownership

const prefixSchema = z.looseObject({ table_prefix: z.string().optional() });

function readTablePrefix(packageDir: string): string | undefined {
  const path = join(packageDir, MANIFEST_FILE);
  if (!existsSync(path)) return undefined;
  try {
    const parsed = prefixSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
    return parsed.success ? parsed.data.table_prefix : undefined;
  } catch {
    return undefined; // an unreadable manifest is reported by check:manifests
  }
}

function migrationFiles(packageDir: string): string[] {
  const dir = join(packageDir, MIGRATIONS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => extname(name) === '.sql')
    .sort()
    .map((name) => join(dir, name));
}

function tableOwnership(
  root: string,
  entry: RegisterEntry,
  prefix: string | undefined,
  absolutePath: string,
  sql: string,
): Violation[] {
  const file = toRepoPath(root, absolutePath);
  const violations: Violation[] = [];
  for (const table of findCreatedTables(sql)) {
    if (table.temporary) continue; // a session-scoped scratch table belongs to no module
    const name = table.schema === undefined ? table.name : `${table.schema}.${table.name}`;
    if (prefix === undefined) {
      violations.push({
        rule: 'table-ownership',
        file,
        line: table.line,
        message: `creates table ${name}, but ${entry.id} declares no table_prefix in ${entry.path}/${MANIFEST_FILE}`,
      });
    } else if (!table.name.startsWith(prefix)) {
      violations.push({
        rule: 'table-ownership',
        file,
        line: table.line,
        message: `creates table ${name}, which does not start with ${entry.id}'s table_prefix ${prefix}`,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------- industry words

/**
 * A line may carry `boundary:allow industry-word <reason>` in a comment, or sit right below
 * a line that does. The reason is required, and a marker that allows nothing is reported,
 * so a stale one cannot linger and quietly widen the exception.
 */
function industryWords(
  root: string,
  absolutePath: string,
  text: string,
  /** The line-comment token of the file type; JSON has none, so it cannot carry a marker. */
  commentToken: '//' | '--' | undefined,
): Violation[] {
  const file = toRepoPath(root, absolutePath);
  const lines = text.split('\n');
  const violations: Violation[] = [];
  const markers = new Map<number, { reason: string | undefined; used: boolean; at: number }>();
  lines.forEach((line, index) => {
    if (commentToken === undefined) return;
    const match = MARKER_PATTERN.exec(line);
    if (match !== null) markers.set(index, { reason: match[1], used: false, at: match.index });
  });

  lines.forEach((line, index) => {
    const own = markers.get(index);
    const above = markers.get(index - 1);
    const marker = own ?? above;
    const scanned = own === undefined ? line : line.slice(0, own.at);
    const hit = WORD_PATTERN.exec(spaceWords(scanned));
    if (hit === null) return;
    if (marker?.reason !== undefined) {
      marker.used = true;
      return;
    }
    violations.push({
      rule: 'industry-word',
      file,
      line: index + 1,
      message: `'${hit[1] ?? ''}' is an industry word; foundation code is industry-neutral (move it to a pack or to configuration${commentToken === undefined ? '' : `, or add '${commentToken} ${WORD_LIST_MARKER} <reason>'`})`,
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
        message: `'${WORD_LIST_MARKER}' allows nothing: no industry word on this line or the next`,
      });
    }
  }
  return violations;
}

/** `fooBar`, `FooBar` and `HTTPServer` split into words; `foo_bar` and `foo-bar` already are. */
function spaceWords(line: string): string {
  return line.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}
