import { basename } from 'node:path';
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
  program.emit(
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

  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) return { exports: [], problems: [] };
  const exportSymbols = checker.getExportsOfModule(moduleSymbol);
  const exportedTargets = new Set(exportSymbols.map((s) => resolve(checker, s)));
  const problems: string[] = [];

  const exports = exportSymbols.map((exported) => {
    const target = resolve(checker, exported);
    const declarations = describeDeclarations(checker, target, emitted);
    for (const text of declarations) {
      if (/\bany\b/.test(text)) {
        problems.push(`${exported.name} exposes \`any\` in the public API: ${oneLine(text)}`);
      }
    }
    problems.push(...forgottenExports(checker, target, exportedTargets, program, exported.name));
    return {
      name: exported.name,
      meanings: meaningsOf(checker, exported),
      declarations: declarations.sort(byText),
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

/** The emitted .d.ts statements that declare `target`, printed without comments. */
function describeDeclarations(
  checker: ts.TypeChecker,
  target: ts.Symbol,
  emitted: ReadonlyMap<string, ts.SourceFile>,
): string[] {
  const texts: string[] = [];
  for (const declaration of target.declarations ?? []) {
    const dts = emitted.get(declaration.getSourceFile().fileName);
    if (ts.isSourceFile(declaration)) {
      // `export * as ns from './x.ts'`: the namespace is that module's whole surface.
      texts.push(
        dts === undefined
          ? 'namespace (external)'
          : `namespace {\n${print(dts.statements, dts)}\n}`,
      );
      continue;
    }
    if (dts === undefined) {
      // Re-exported from another package: record the type, which names the package's own types.
      const type = checker.getTypeOfSymbolAtLocation(target, declaration);
      texts.push(
        `(external) ${checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation)}`,
      );
      continue;
    }
    const matches = dts.statements.filter((statement) => declares(statement, target.name));
    if (matches.length > 0) texts.push(print(matches, dts));
  }
  return [...new Set(texts)];
}

function declares(statement: ts.Statement, name: string): boolean {
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
 * A type used by an exported declaration but declared in this package and not exported
 * is a "forgotten export": consumers depend on it, but its changes would be invisible.
 */
function forgottenExports(
  checker: ts.TypeChecker,
  target: ts.Symbol,
  exportedTargets: ReadonlySet<ts.Symbol>,
  program: ts.Program,
  exportName: string,
): string[] {
  const problems: string[] = [];
  const visit = (node: ts.Node): void => {
    let nameNode: ts.Node | undefined;
    if (ts.isTypeReferenceNode(node)) nameNode = node.typeName;
    else if (ts.isExpressionWithTypeArguments(node)) nameNode = node.expression;
    if (nameNode !== undefined) {
      const symbol = checker.getSymbolAtLocation(
        ts.isQualifiedName(nameNode) ? nameNode.left : nameNode,
      );
      const referenced = symbol === undefined ? undefined : resolve(checker, symbol);
      const declaration = referenced?.declarations?.[0];
      const file = declaration?.getSourceFile();
      if (
        referenced !== undefined &&
        file !== undefined &&
        !exportedTargets.has(referenced) &&
        (referenced.flags & ts.SymbolFlags.TypeParameter) === 0 &&
        !program.isSourceFileFromExternalLibrary(file) &&
        !program.isSourceFileDefaultLibrary(file) &&
        !file.fileName.includes('/node_modules/')
      ) {
        problems.push(
          `${exportName} uses ${referenced.name}, which is declared in this package but not exported; export it so its changes are tracked`,
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  for (const declaration of target.declarations ?? []) {
    if (!ts.isSourceFile(declaration)) typePositions(declaration).forEach(visit);
  }
  return problems;
}

/** The type positions of a declaration, never function bodies or initialisers. */
function typePositions(declaration: ts.Node): ts.Node[] {
  const nodes: ts.Node[] = [];
  const fromSignature = (d: ts.SignatureDeclaration): void => {
    d.typeParameters?.forEach((p) => nodes.push(p));
    for (const p of d.parameters) if (p.type !== undefined) nodes.push(p.type);
    if (d.type !== undefined) nodes.push(d.type);
  };
  if (ts.isFunctionDeclaration(declaration)) fromSignature(declaration);
  else if (ts.isVariableDeclaration(declaration)) {
    if (declaration.type !== undefined) nodes.push(declaration.type);
  } else if (ts.isClassDeclaration(declaration)) {
    declaration.heritageClauses?.forEach((h) => nodes.push(h));
    for (const member of declaration.members) {
      const modifiers = ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined;
      if (modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword) === true) continue;
      if (ts.isPropertyDeclaration(member) && member.type !== undefined) nodes.push(member.type);
      if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member))
        fromSignature(member);
    }
  } else nodes.push(declaration);
  return nodes;
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
      optional: ts.isPropertySignature(m) && m.questionToken !== undefined,
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
