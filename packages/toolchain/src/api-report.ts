import { basename, dirname, join } from 'node:path';
import ts from 'typescript';

/**
 * Public-API reports and the semver gate (K0-T09). The report is built from the
 * compiler's own declaration output (.d.ts), normalised, so it sees everything a
 * consumer can depend on: signatures, overloads, constructors, statics, modifiers,
 * readonly, call and index signatures, enums, namespaces and merged declarations. Any
 * change in that text is breaking unless it is provably an addition.
 */

/** Bump when the report shape or normalisation changes; a format change needs an explicit flag. */
export const API_REPORT_FORMAT = 2;

export type Meaning = 'value' | 'type' | 'namespace';

export interface ApiExport {
  readonly name: string;
  /** What the export is usable as; `export type` drops `value`. */
  readonly meanings: readonly Meaning[];
  /** Normalised declaration text, one entry per declaration (merged declarations give several). */
  readonly declarations: readonly string[];
}

export interface ApiReport {
  readonly format: number;
  readonly package: string;
  readonly version: string;
  readonly exports: readonly ApiExport[];
}

export interface ApiExtraction {
  readonly exports: ApiExport[];
  /** Fail-closed findings: forgotten exports and `any` in the public API. */
  readonly problems: string[];
}

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Reads the public API of `entry`, compiled with the package's tsconfig. */
export function extractApi(options: {
  readonly tsconfigPath: string;
  readonly entry: string;
}): ApiExtraction {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    options.tsconfigPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );
  if (parsed === undefined) throw new Error(`cannot read ${options.tsconfigPath}`);
  // rootDir would reject files outside src; declaration output only needs outDir.
  const base: ts.CompilerOptions = { ...parsed.options };
  delete base.rootDir;
  const program = ts.createProgram([options.entry], {
    ...base,
    noEmit: false,
    declaration: true,
    emitDeclarationOnly: true,
    declarationMap: false,
    sourceMap: false,
    outDir: '/__gx_api__',
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(options.entry);
  if (source === undefined) throw new Error(`cannot read ${options.entry}`);

  // Declaration output per source file, parsed, keyed by the source file name.
  const emitted = new Map<string, ts.SourceFile>();
  const emit = program.emit(
    undefined,
    (fileName, text, _bom, _onError, sourceFiles) => {
      const from = sourceFiles?.[0]?.fileName;
      if (from !== undefined && fileName.endsWith('.d.ts')) {
        emitted.set(
          from,
          ts.createSourceFile(basename(fileName), text, ts.ScriptTarget.Latest, true),
        );
      }
    },
    undefined,
    true,
  );
  const problems: string[] = emit.diagnostics.map(
    (d) => `declaration output failed: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`,
  );

  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) return { exports: [], problems };
  const exportSymbols = checker.getExportsOfModule(moduleSymbol);
  const exported = exportedKeys(checker, exportSymbols);

  const exports = exportSymbols.map((symbol) => {
    const target = resolve(checker, symbol);
    const { texts, nodes } = describeDeclarations(checker, target, emitted);
    if (texts.length === 0) {
      problems.push(
        `${symbol.name} cannot be described from the declaration output, so its changes would be invisible`,
      );
    }
    problems.push(...inspectDeclarations(symbol.name, nodes, emitted, exported));
    return {
      name: symbol.name,
      meanings: meaningsOf(checker, symbol),
      declarations: texts.sort(byText),
    };
  });
  return {
    exports: exports.sort((a, b) => byText(a.name, b.name)),
    problems: [...new Set(problems)].sort(byText),
  };
}

function resolve(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol {
  return (symbol.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(symbol) : symbol;
}

/** `file#name` for every declaration reachable as an export, including `export * as ns` members. */
function exportedKeys(checker: ts.TypeChecker, exports: readonly ts.Symbol[]): Set<string> {
  const keys = new Set<string>();
  for (const symbol of exports) {
    const target = resolve(checker, symbol);
    for (const declaration of target.declarations ?? []) {
      if (ts.isSourceFile(declaration)) {
        const moduleSymbol = checker.getSymbolAtLocation(declaration);
        const members = moduleSymbol === undefined ? [] : checker.getExportsOfModule(moduleSymbol);
        for (const member of exportedKeys(checker, members)) keys.add(member);
      } else {
        keys.add(`${declaration.getSourceFile().fileName}#${target.name}`);
      }
    }
  }
  return keys;
}

/** Meanings as seen by an importer, so `export type { x }` of a value is type-only. */
function meaningsOf(checker: ts.TypeChecker, exported: ts.Symbol): Meaning[] {
  const target = resolve(checker, exported);
  const typeOnly =
    exported.declarations?.some(
      (d) => ts.isExportSpecifier(d) && (d.isTypeOnly || d.parent.parent.isTypeOnly),
    ) ?? false;
  const meanings: Meaning[] = [];
  if ((target.flags & ts.SymbolFlags.Value) !== 0 && !typeOnly) meanings.push('value');
  if ((target.flags & ts.SymbolFlags.Type) !== 0) meanings.push('type');
  if ((target.flags & (ts.SymbolFlags.Namespace | ts.SymbolFlags.ValueModule)) !== 0) {
    meanings.push('namespace');
  }
  return meanings;
}

interface EmittedNode {
  readonly statement: ts.Statement;
  readonly sourceFileName: string;
}

/** The emitted .d.ts statements that declare `target`, printed without comments. */
function describeDeclarations(
  checker: ts.TypeChecker,
  target: ts.Symbol,
  emitted: ReadonlyMap<string, ts.SourceFile>,
): { texts: string[]; nodes: EmittedNode[] } {
  const texts: string[] = [];
  const nodes: EmittedNode[] = [];
  for (const declaration of target.declarations ?? []) {
    const sourceFileName = declaration.getSourceFile().fileName;
    const dts = emitted.get(sourceFileName);
    if (ts.isSourceFile(declaration)) {
      // `export * as ns from './x.ts'`: the namespace is that module's whole surface.
      if (dts !== undefined) {
        texts.push(`namespace {\n${print(dts.statements, dts)}\n}`);
        nodes.push(...dts.statements.map((statement) => ({ statement, sourceFileName })));
      }
      continue;
    }
    if (dts === undefined) {
      // Re-exported from another package: record the type, which names that package's types.
      const type = checker.getTypeOfSymbolAtLocation(target, declaration);
      texts.push(
        `(external) ${checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation)}`,
      );
      continue;
    }
    const matches = dts.statements.filter((statement) => declares(statement, target.name));
    if (matches.length > 0) {
      texts.push(print(matches, dts));
      nodes.push(...matches.map((statement) => ({ statement, sourceFileName })));
    }
  }
  return { texts: [...new Set(texts)], nodes };
}

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  (ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)?.some((m) => m.kind === kind) ===
  true;

function declares(statement: ts.Statement, name: string): boolean {
  if (name === 'default') {
    // `export default function (...)`, `export default class {}`, and
    // `declare const _default: ...; export default _default;` for expressions.
    if (ts.isExportAssignment(statement)) return true;
    if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) return true;
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.some(
        (d) => ts.isIdentifier(d.name) && d.name.text === '_default',
      );
    }
    return false;
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.some(
      (d) => ts.isIdentifier(d.name) && d.name.text === name,
    );
  }
  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement)
  ) {
    const node = statement.name;
    return (
      node !== undefined &&
      (ts.isIdentifier(node) || ts.isStringLiteral(node)) &&
      node.text === name
    );
  }
  return false;
}

/** Prints statements without comments or export keywords, so text reflects shape only. */
function print(statements: readonly ts.Statement[], file: ts.SourceFile): string {
  return statements
    .map((statement) =>
      printer
        .printNode(ts.EmitHint.Unspecified, statement, file)
        .replace(/^export (?:default )?/, ''),
    )
    .join('\n');
}

/**
 * Walks the emitted declarations, where inferred types are written out:
 * `any` anywhere is a problem, and so is a "forgotten export", a type declared in this
 * package but not exported, whose changes consumers depend on but would never see.
 */
function inspectDeclarations(
  exportName: string,
  nodes: readonly EmittedNode[],
  emitted: ReadonlyMap<string, ts.SourceFile>,
  exported: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  for (const { statement, sourceFileName } of nodes) {
    const dts = emitted.get(sourceFileName);
    if (dts === undefined) continue;
    const visit = (node: ts.Node): void => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) {
        problems.push(`${exportName} exposes \`any\` in the public API`);
      }
      // A private class member's type is not part of the API.
      if (ts.isPropertyDeclaration(node) && hasModifier(node, ts.SyntaxKind.PrivateKeyword)) return;
      const referenced = referencedDeclaration(node, sourceFileName, dts, emitted);
      if (referenced !== undefined && !exported.has(referenced.key)) {
        problems.push(
          `${exportName} uses ${referenced.name}, which is declared in this package but not exported; export it so its changes are tracked`,
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(statement);
  }
  return problems;
}

/** The package declaration a type reference in emitted .d.ts points at, if any. */
function referencedDeclaration(
  node: ts.Node,
  sourceFileName: string,
  dts: ts.SourceFile,
  emitted: ReadonlyMap<string, ts.SourceFile>,
): { key: string; name: string } | undefined {
  if (ts.isImportTypeNode(node)) {
    const literal = ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
    const name = node.qualifier === undefined ? undefined : leftmost(node.qualifier);
    if (literal === undefined || !ts.isStringLiteral(literal) || name === undefined)
      return undefined;
    return inPackage(relativeSource(sourceFileName, literal.text, emitted), name, emitted);
  }
  let nameNode: ts.EntityName | ts.Expression | undefined;
  if (ts.isTypeReferenceNode(node)) nameNode = node.typeName;
  else if (ts.isExpressionWithTypeArguments(node)) nameNode = node.expression;
  if (nameNode === undefined) return undefined;
  const name = ts.isIdentifier(nameNode)
    ? nameNode.text
    : ts.isQualifiedName(nameNode)
      ? leftmost(nameNode)
      : undefined;
  if (name === undefined) return undefined;
  if (dts.statements.some((statement) => declares(statement, name))) {
    return { key: `${sourceFileName}#${name}`, name };
  }
  for (const statement of dts.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
    const element = bindings.elements.find((e) => e.name.text === name);
    if (element === undefined) continue;
    const original = element.propertyName?.text ?? name;
    return inPackage(
      relativeSource(sourceFileName, statement.moduleSpecifier.text, emitted),
      original,
      emitted,
    );
  }
  return undefined;
}

function leftmost(name: ts.EntityName): string {
  return ts.isIdentifier(name) ? name.text : leftmost(name.left);
}

/** The package source file a relative specifier in a .d.ts refers to, or undefined. */
function relativeSource(
  from: string,
  specifier: string,
  emitted: ReadonlyMap<string, ts.SourceFile>,
): string | undefined {
  if (!specifier.startsWith('.')) return undefined;
  const base = join(dirname(from), specifier).replace(/\.(?:d\.ts|js|ts)$/, '');
  return [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((candidate) =>
    emitted.has(candidate),
  );
}

function inPackage(
  file: string | undefined,
  name: string,
  emitted: ReadonlyMap<string, ts.SourceFile>,
): { key: string; name: string } | undefined {
  if (file === undefined) return undefined;
  const dts = emitted.get(file);
  return dts?.statements.some((statement) => declares(statement, name)) === true
    ? { key: `${file}#${name}`, name }
    : undefined;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, 160);
}

// ---------------------------------------------------------------- semver gate

export type Bump = 'none' | 'patch' | 'minor' | 'major';
export type ChangeKind = 'added' | 'removed' | 'changed' | 'widened';

export interface ApiChange {
  readonly name: string;
  readonly kind: ChangeKind;
  /** True when code written against the old API may stop compiling or working. */
  readonly breaking: boolean;
  readonly detail: string;
}

/**
 * Compares two export lists. Any change in an export's meanings or declaration text is
 * breaking, except a proven addition: a new export, or an interface that only gains
 * optional members.
 */
export function diffApi(base: readonly ApiExport[], current: readonly ApiExport[]): ApiChange[] {
  const changes: ApiChange[] = [];
  const before = new Map(base.map((e) => [e.name, e]));
  const after = new Map(current.map((e) => [e.name, e]));
  for (const [name, old] of before) {
    const now = after.get(name);
    if (now === undefined) {
      changes.push({ name, kind: 'removed', breaking: true, detail: `${name} was removed` });
      continue;
    }
    if (old.meanings.join('+') !== now.meanings.join('+')) {
      changes.push({
        name,
        kind: 'changed',
        breaking: true,
        detail: `${name} changed from ${old.meanings.join('+')} to ${now.meanings.join('+')}`,
      });
      continue;
    }
    if (JSON.stringify(old.declarations) === JSON.stringify(now.declarations)) continue;
    const widened = onlyOptionalMembersAdded(old.declarations, now.declarations);
    changes.push({
      name,
      kind: widened ? 'widened' : 'changed',
      breaking: !widened,
      detail: `${name}: ${oneLine(old.declarations.join(' '))} -> ${oneLine(now.declarations.join(' '))}`,
    });
  }
  for (const name of after.keys()) {
    if (!before.has(name)) {
      changes.push({ name, kind: 'added', breaking: false, detail: `${name} was added` });
    }
  }
  return changes.sort((a, b) => byText(a.name, b.name));
}

interface InterfaceParts {
  readonly header: string;
  readonly members: readonly { readonly text: string; readonly optional: boolean }[];
}

/** True when both sides are one interface with the same header and only optional members were added. */
function onlyOptionalMembersAdded(before: readonly string[], after: readonly string[]): boolean {
  if (before.length !== 1 || after.length !== 1) return false;
  const left = interfaceParts(before[0] ?? '');
  const right = interfaceParts(after[0] ?? '');
  if (left === undefined || right === undefined || left.header !== right.header) return false;
  const leftTexts = new Set(left.members.map((m) => m.text));
  const rightTexts = new Set(right.members.map((m) => m.text));
  const kept = [...leftTexts].every((text) => rightTexts.has(text));
  const added = right.members.filter((m) => !leftTexts.has(m.text));
  return kept && added.every((m) => m.optional);
}

function interfaceParts(text: string): InterfaceParts | undefined {
  const file = ts.createSourceFile('x.d.ts', text, ts.ScriptTarget.Latest, true);
  const [statement] = file.statements;
  if (
    file.statements.length !== 1 ||
    statement === undefined ||
    !ts.isInterfaceDeclaration(statement)
  ) {
    return undefined;
  }
  return {
    header: text.slice(0, text.indexOf('{')),
    members: statement.members.map((m) => ({
      text: printer.printNode(ts.EmitHint.Unspecified, m, file),
      optional:
        (ts.isPropertySignature(m) || ts.isMethodSignature(m)) && m.questionToken !== undefined,
    })),
  };
}

export interface Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

export function parseVersion(text: string): Version | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (match === null) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/** The bump from `base` to `current`, or `downgrade` when the version went back. */
export function bumpBetween(base: Version, current: Version): Bump | 'downgrade' {
  const a = [base.major, base.minor, base.patch];
  const b = [current.major, current.minor, current.patch];
  for (let i = 0; i < 3; i += 1) {
    if ((b[i] ?? 0) > (a[i] ?? 0)) return (['major', 'minor', 'patch'] as const)[i] ?? 'patch';
    if ((b[i] ?? 0) < (a[i] ?? 0)) return 'downgrade';
  }
  return 'none';
}

/**
 * The bump the changes need. From 1.0.0: a break needs major, an addition minor. Before
 * 1.0.0 (unpublished, one workspace): a break needs minor, an addition needs nothing.
 */
export function requiredBump(changes: readonly ApiChange[], base: Version): Bump {
  const breaking = changes.some((c) => c.breaking);
  if (base.major === 0) return breaking ? 'minor' : 'none';
  if (breaking) return 'major';
  return changes.length > 0 ? 'minor' : 'none';
}

const RANK: Readonly<Record<Bump, number>> = { none: 0, patch: 1, minor: 2, major: 3 };

export function bumpSatisfies(actual: Bump, required: Bump): boolean {
  return RANK[actual] >= RANK[required];
}
