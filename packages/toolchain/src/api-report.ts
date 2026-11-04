import ts from 'typescript';

/**
 * Public-API reports and the semver gate (K0-T09). A report lists every export of a
 * package's public-API file with its kind and type signature. It is committed, so every
 * API change shows up in review, and compared with the base branch's report to decide
 * which version bump the change needs.
 */

export type ExportKind = 'function' | 'value' | 'type' | 'interface' | 'class';

export interface ApiExport {
  readonly name: string;
  readonly kind: ExportKind;
  /** Type text; for interfaces and classes, one entry per member. */
  readonly signature: string;
  /** Interface and class members as `name: type`, with `?` on optional members. */
  readonly members?: readonly string[];
}

export interface ApiReport {
  readonly package: string;
  readonly version: string;
  readonly exports: readonly ApiExport[];
}

/** Names stay names (`AiClientId`, not its expansion), so a report changes only with its own package. */
const FORMAT: ts.TypeFormatFlags =
  ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.WriteArrowStyleSignature;
/** For a type alias's own body: expand it, so a change to the alias itself shows. */
const ALIAS_BODY: ts.TypeFormatFlags = FORMAT | ts.TypeFormatFlags.InTypeAlias;

/** Reads the public API of `entry`, compiled with the package's tsconfig. */
export function extractApi(options: {
  readonly tsconfigPath: string;
  readonly entry: string;
}): ApiExport[] {
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
  const program = ts.createProgram([options.entry], parsed.options);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(options.entry);
  if (source === undefined) throw new Error(`cannot read ${options.entry}`);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) return [];

  return checker
    .getExportsOfModule(moduleSymbol)
    .map((symbol) => describe(checker, symbol))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function describe(checker: ts.TypeChecker, exported: ts.Symbol): ApiExport {
  const symbol =
    (exported.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(exported) : exported;
  const name = exported.name;
  const declaration = symbol.declarations?.[0];
  if (
    declaration !== undefined &&
    (ts.isInterfaceDeclaration(declaration) || ts.isClassDeclaration(declaration))
  ) {
    const declared = checker.getDeclaredTypeOfSymbol(symbol);
    const members = checker
      .getPropertiesOfType(declared)
      .map((member) => {
        const optional = (member.flags & ts.SymbolFlags.Optional) !== 0 ? '?' : '';
        const type = checker.typeToString(checker.getTypeOfSymbol(member), undefined, FORMAT);
        return `${member.name}${optional}: ${type}`;
      })
      .sort();
    const kind: ExportKind = ts.isInterfaceDeclaration(declaration) ? 'interface' : 'class';
    const heritage = declaration.typeParameters?.map((p) => p.getText()).join(', ') ?? '';
    return { name, kind, signature: heritage === '' ? name : `${name}<${heritage}>`, members };
  }
  if (declaration !== undefined && ts.isTypeAliasDeclaration(declaration)) {
    const params = declaration.typeParameters?.map((p) => p.getText()).join(', ');
    const body = checker.typeToString(
      checker.getDeclaredTypeOfSymbol(symbol),
      undefined,
      ALIAS_BODY,
    );
    return { name, kind: 'type', signature: params === undefined ? body : `<${params}> ${body}` };
  }
  const type = checker.getTypeOfSymbol(symbol);
  const kind: ExportKind =
    type.getCallSignatures().length > 0 &&
    declaration !== undefined &&
    ts.isFunctionDeclaration(declaration)
      ? 'function'
      : 'value';
  return { name, kind, signature: checker.typeToString(type, undefined, FORMAT) };
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
 * Compares two export lists. A removal or a changed signature is breaking. An added
 * export, or an interface that only gains optional members, is additive.
 */
export function diffApi(base: readonly ApiExport[], current: readonly ApiExport[]): ApiChange[] {
  const changes: ApiChange[] = [];
  const before = new Map(base.map((e) => [e.name, e]));
  const after = new Map(current.map((e) => [e.name, e]));
  for (const [name, old] of before) {
    const now = after.get(name);
    if (now === undefined) {
      changes.push({
        name,
        kind: 'removed',
        breaking: true,
        detail: `${old.kind} ${name} was removed`,
      });
    } else if (now.kind !== old.kind || now.signature !== old.signature) {
      changes.push({
        name,
        kind: 'changed',
        breaking: true,
        detail: `${name}: ${old.signature} -> ${now.signature}`,
      });
    } else if (JSON.stringify(now.members ?? []) !== JSON.stringify(old.members ?? [])) {
      const oldMembers = new Set(old.members ?? []);
      const newMembers = new Set(now.members ?? []);
      const removed = [...oldMembers].filter((m) => !newMembers.has(m));
      const added = [...newMembers].filter((m) => !oldMembers.has(m));
      const onlyOptionalAdded = removed.length === 0 && added.every((m) => /^[^:]+\?:/.test(m));
      changes.push({
        name,
        kind: onlyOptionalAdded ? 'widened' : 'changed',
        breaking: !onlyOptionalAdded,
        detail: `${name}: ${[...removed.map((m) => `- ${m}`), ...added.map((m) => `+ ${m}`)].join('; ')}`,
      });
    }
  }
  for (const [name, now] of after) {
    if (!before.has(name))
      changes.push({
        name,
        kind: 'added',
        breaking: false,
        detail: `${now.kind} ${name} was added`,
      });
  }
  return changes.sort((a, b) => a.name.localeCompare(b.name));
}

interface Version {
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
  const order = (v: Version): [number, number, number] => [v.major, v.minor, v.patch];
  const [a, b] = [order(base), order(current)];
  for (let i = 0; i < 3; i += 1) {
    if ((b[i] ?? 0) > (a[i] ?? 0)) return (['major', 'minor', 'patch'] as const)[i] ?? 'patch';
    if ((b[i] ?? 0) < (a[i] ?? 0)) return 'downgrade';
  }
  return 'none';
}

/**
 * The bump the changes need. Semver: a break needs a major bump and an addition a minor
 * one. Before 1.0.0 everything shifts down one place (break: minor, addition: patch).
 */
export function requiredBump(changes: readonly ApiChange[], base: Version): Bump {
  if (changes.length === 0) return 'none';
  const breaking = changes.some((c) => c.breaking);
  if (base.major === 0) return breaking ? 'minor' : 'patch';
  return breaking ? 'major' : 'minor';
}

const RANK: Readonly<Record<Bump, number>> = { none: 0, patch: 1, minor: 2, major: 3 };

export function bumpSatisfies(actual: Bump, required: Bump): boolean {
  return RANK[actual] >= RANK[required];
}
