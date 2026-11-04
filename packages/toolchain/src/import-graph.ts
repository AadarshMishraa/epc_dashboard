import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import { findImports } from './imports.ts';
import { allDepends, parseRegister, type Register, type RegisterEntry } from './register.ts';

export type RuleId =
  /** packages/register.json is missing, malformed or inconsistent. */
  | 'register-invalid'
  /** The register and the packages on disk disagree. */
  | 'register-mismatch'
  /** A package does not expose exactly one public-API file. */
  | 'public-api'
  /** package.json declares a workspace dependency the register does not allow. */
  | 'workspace-dependency'
  /** Source imports a workspace package that is not a declared dependency. */
  | 'import-not-allowed'
  /** Source imports another package's internals instead of its public API. */
  | 'deep-import'
  /** Source imports its own package by name instead of by relative path. */
  | 'self-import'
  /** A relative import leaves the package directory. */
  | 'relative-escape'
  /** Source imports a package or builtin its package.json does not declare, or a computed specifier. */
  | 'undeclared-import'
  /** A package the register marks `isolated` (core) has a dependency or uses Node.js I/O. */
  | 'isolation';

export interface Violation {
  readonly rule: RuleId;
  readonly message: string;
  /** Repository-relative path with forward slashes, when the problem is in one file. */
  readonly file?: string;
  readonly line?: number;
}

export interface ImportGraphResult {
  readonly violations: readonly Violation[];
  readonly packagesChecked: number;
  readonly filesChecked: number;
}

export interface ImportGraphOptions {
  /** Repository root: holds package.json and packages/register.json. */
  readonly root: string;
}

export const REGISTER_PATH = 'packages/register.json';
const PACKAGES_DIR = 'packages';
const WORKSPACE_SCOPE = '@gx/';
const WORKSPACE_SPEC = 'workspace:*';
/** Specs that install from the local disk rather than the registry. */
const LOCAL_SPEC = /^(workspace|link|file|portal):/;
const PUBLIC_API_FILE = 'src/index.ts';
/** The one export every package has: source for tools and tests, built files for runtime. */
const PUBLIC_API_EXPORT = {
  '@gx/source': `./${PUBLIC_API_FILE}`,
  types: './dist/index.d.ts',
  default: './dist/index.js',
} as const;
/** Fields that would add a second entry point next to `exports`. */
const ENTRY_POINT_FIELDS = ['main', 'module', 'browser', 'types', 'typings'] as const;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
const SKIPPED_DIRS = new Set(['node_modules', 'dist']);
const BUILTINS = new Set(builtinModules);

const dependencyMapSchema = z.record(z.string(), z.string()).optional();
const packageJsonSchema = z.looseObject({
  name: z.string(),
  exports: z.unknown().optional(),
  dependencies: dependencyMapSchema,
  devDependencies: dependencyMapSchema,
  peerDependencies: dependencyMapSchema,
  optionalDependencies: dependencyMapSchema,
});
type PackageJson = z.infer<typeof packageJsonSchema>;

/**
 * Checks that the workspace matches packages/register.json and that every package
 * depends only on what the register allows, through public APIs only.
 */
export function checkImportGraph(options: ImportGraphOptions): ImportGraphResult {
  const root = resolve(options.root);
  const loaded = loadRegister(root);
  if (!loaded.ok) return { violations: loaded.violations, packagesChecked: 0, filesChecked: 0 };

  const { register } = loaded;
  const violations: Violation[] = [...diskMismatches(root, register)];
  const rootDevDependencies = new Set(Object.keys(readRootDevDependencies(root)));
  let packagesChecked = 0;
  let filesChecked = 0;

  for (const entry of register.packages) {
    const manifestPath = join(root, entry.path, 'package.json');
    if (!existsSync(manifestPath)) continue; // reported by diskMismatches
    const pkg = readPackageJson(root, manifestPath, violations);
    if (pkg === undefined) continue;
    packagesChecked += 1;
    const context: PackageContext = { root, entry, register, pkg, rootDevDependencies };
    violations.push(...checkManifest(context));
    for (const file of listSourceFiles(join(root, entry.path, 'src'))) {
      filesChecked += 1;
      violations.push(...checkFile(context, file));
    }
  }
  return { violations: sortViolations(violations), packagesChecked, filesChecked };
}

export function formatViolation(violation: Violation): string {
  const where =
    violation.file === undefined
      ? '(workspace)'
      : violation.line === undefined
        ? violation.file
        : `${violation.file}:${String(violation.line)}`;
  return `${where} [${violation.rule}] ${violation.message}`;
}

// ---------------------------------------------------------------- register and disk

type Loaded =
  | { readonly ok: true; readonly register: Register }
  | { readonly ok: false; readonly violations: readonly Violation[] };

function loadRegister(root: string): Loaded {
  const fail = (message: string): Loaded => ({
    ok: false,
    violations: [{ rule: 'register-invalid', file: REGISTER_PATH, message }],
  });
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(root, REGISTER_PATH), 'utf8'));
  } catch (error) {
    return fail(`cannot read the register: ${describeError(error)}`);
  }
  const parsed = parseRegister(raw);
  if (!parsed.ok) {
    return {
      ok: false,
      violations: parsed.problems.map((message) => ({
        rule: 'register-invalid' as const,
        file: REGISTER_PATH,
        message,
      })),
    };
  }
  return { ok: true, register: parsed.register };
}

function diskMismatches(root: string, register: Register): Violation[] {
  const violations: Violation[] = [];
  const registered = new Set(register.packages.map((entry) => entry.path));
  for (const entry of register.packages) {
    if (!existsSync(join(root, entry.path, 'package.json'))) {
      violations.push({
        rule: 'register-mismatch',
        file: REGISTER_PATH,
        message: `${entry.id} is registered at ${entry.path}, but ${entry.path}/package.json does not exist`,
      });
    }
  }
  const packagesDir = join(root, PACKAGES_DIR);
  for (const name of existsSync(packagesDir) ? readdirSync(packagesDir).sort() : []) {
    const path = `${PACKAGES_DIR}/${name}`;
    if (existsSync(join(root, path, 'package.json')) && !registered.has(path)) {
      violations.push({
        rule: 'register-mismatch',
        file: `${path}/package.json`,
        message: `${path} is a workspace package but has no entry in ${REGISTER_PATH}`,
      });
    }
  }
  return violations;
}

function readRootDevDependencies(root: string): Record<string, string> {
  const path = join(root, 'package.json');
  if (!existsSync(path)) return {};
  const parsed = z
    .looseObject({ devDependencies: dependencyMapSchema })
    .safeParse(JSON.parse(readFileSync(path, 'utf8')));
  return parsed.success ? (parsed.data.devDependencies ?? {}) : {};
}

function readPackageJson(
  root: string,
  manifestPath: string,
  violations: Violation[],
): PackageJson | undefined {
  const file = toRepoPath(root, manifestPath);
  try {
    const parsed = packageJsonSchema.safeParse(JSON.parse(readFileSync(manifestPath, 'utf8')));
    if (parsed.success) return parsed.data;
    violations.push({
      rule: 'register-mismatch',
      file,
      message: `package.json is not valid: ${parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'} ${i.message}`).join('; ')}`,
    });
  } catch (error) {
    violations.push({
      rule: 'register-mismatch',
      file,
      message: `cannot read package.json: ${describeError(error)}`,
    });
  }
  return undefined;
}

// ---------------------------------------------------------------- one package

interface PackageContext {
  readonly root: string;
  readonly entry: RegisterEntry;
  readonly register: Register;
  readonly pkg: PackageJson;
  readonly rootDevDependencies: ReadonlySet<string>;
}

function checkManifest(context: PackageContext): Violation[] {
  const { entry, pkg } = context;
  const file = `${entry.path}/package.json`;
  const violations: Violation[] = [];
  const add = (rule: RuleId, message: string): void => {
    violations.push({ rule, file, message });
  };

  if (pkg.name !== entry.package) {
    add('register-mismatch', `name is ${pkg.name}, but the register expects ${entry.package}`);
  }

  // Exactly one public-API file: a single "." export with the standard conditions.
  const exportKeys = isRecord(pkg.exports) ? Object.keys(pkg.exports) : [];
  if (!isRecord(pkg.exports) || exportKeys.length !== 1 || exportKeys[0] !== '.') {
    add(
      'public-api',
      `exports must have exactly one entry, "."; found ${isRecord(pkg.exports) ? JSON.stringify(exportKeys) : JSON.stringify(pkg.exports ?? null)}`,
    );
  } else if (JSON.stringify(pkg.exports['.']) !== JSON.stringify(PUBLIC_API_EXPORT)) {
    add(
      'public-api',
      `exports["."] must be ${JSON.stringify(PUBLIC_API_EXPORT)}; found ${JSON.stringify(pkg.exports['.'])}`,
    );
  }
  for (const field of ENTRY_POINT_FIELDS) {
    if (field in pkg) add('public-api', `remove "${field}": exports["."] is the only entry point`);
  }
  if (!existsSync(join(context.root, entry.path, PUBLIC_API_FILE))) {
    add('public-api', `the public-API file ${entry.path}/${PUBLIC_API_FILE} does not exist`);
  }

  // Workspace dependencies must be allowed by the register and use the workspace protocol.
  const runtimeAllowed = new Set(entry.depends);
  const testAllowed = new Set(allDepends(entry));
  const sections = [
    ['dependencies', pkg.dependencies, runtimeAllowed],
    ['peerDependencies', pkg.peerDependencies, runtimeAllowed],
    ['optionalDependencies', pkg.optionalDependencies, runtimeAllowed],
    ['devDependencies', pkg.devDependencies, testAllowed],
  ] as const;
  for (const [section, deps, allowed] of sections) {
    for (const [name, spec] of Object.entries(deps ?? {})) {
      if (entry.isolated === true && section !== 'devDependencies') {
        add('isolation', `${entry.id} has no dependencies, but ${section} names ${name}`);
      }
      if (!name.startsWith(WORKSPACE_SCOPE)) {
        // An alias would let `import 'x'` reach a workspace package past the register.
        if (LOCAL_SPEC.test(spec) || spec.startsWith(`npm:${WORKSPACE_SCOPE}`)) {
          add(
            'workspace-dependency',
            `${section}.${name} (${spec}) aliases a local package; depend on workspace packages by their @gx/ name`,
          );
        }
        continue;
      }
      const target = context.register.packages.find((other) => other.package === name);
      if (target === undefined) {
        add('workspace-dependency', `${section} names ${name}, which is not in ${REGISTER_PATH}`);
      } else if (!allowed.has(target.id)) {
        add(
          'workspace-dependency',
          `${section} names ${name}, but the register allows ${entry.id} ${describeAllowed(context, allowed)}`,
        );
      }
      if (spec !== WORKSPACE_SPEC) {
        // `workspace:@gx/other@*` would install a different package under this name.
        add(
          'workspace-dependency',
          `${section}.${name} must be "${WORKSPACE_SPEC}", found ${spec}`,
        );
      }
    }
  }
  return violations;
}

function checkFile(context: PackageContext, absolutePath: string): Violation[] {
  const { root, entry, pkg } = context;
  const file = toRepoPath(root, absolutePath);
  const isTest = TEST_FILE.test(absolutePath);
  const runtimeDeclared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ]);
  const devDeclared = new Set([
    ...Object.keys(pkg.devDependencies ?? {}),
    ...context.rootDevDependencies,
  ]);
  const declared = (name: string): boolean =>
    runtimeDeclared.has(name) || (isTest && devDeclared.has(name));

  const violations: Violation[] = [];
  const references = findImports(readFileSync(absolutePath, 'utf8'), absolutePath);
  for (const { specifier, line, computed } of references) {
    const add = (rule: RuleId, message: string): void => {
      violations.push({ rule, file, line, message });
    };

    if (computed === true) {
      add(
        'undeclared-import',
        `${specifier} is computed, so it cannot be checked; use a string literal`,
      );
      continue;
    }

    if (
      specifier === '.' ||
      specifier === '..' ||
      specifier.startsWith('./') ||
      specifier.startsWith('../')
    ) {
      const target = resolve(dirname(absolutePath), specifier);
      if (!isInside(join(root, entry.path), target)) {
        add(
          'relative-escape',
          `'${specifier}' leaves ${entry.path}; import other packages by their package name`,
        );
      }
      continue;
    }
    if (specifier.startsWith('node:')) {
      if (entry.isolated === true && !isTest) {
        add('isolation', `'${specifier}' is I/O; ${entry.id} has no I/O (tests may use Node.js)`);
      }
      continue;
    }
    if (specifier.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(specifier)) {
      add(
        'undeclared-import',
        `'${specifier}' is an absolute path or URL; use a package name or a relative path`,
      );
      continue;
    }
    if (specifier.startsWith('#')) {
      add(
        'undeclared-import',
        `'${specifier}' uses package subpath imports, which this workspace does not use`,
      );
      continue;
    }
    const name = packageNameOf(specifier);
    if (BUILTINS.has(specifier) || BUILTINS.has(name)) {
      add(
        'undeclared-import',
        `'${specifier}' is a Node.js builtin; import it as 'node:${specifier}'`,
      );
      continue;
    }

    if (name.startsWith(WORKSPACE_SCOPE)) {
      const target = context.register.packages.find((other) => other.package === name);
      if (name === entry.package) {
        add('self-import', `'${specifier}' imports this package by name; use a relative path`);
      } else if (target === undefined) {
        add('import-not-allowed', `'${specifier}' is not a package in ${REGISTER_PATH}`);
      } else if (specifier !== name) {
        add(
          'deep-import',
          `'${specifier}' reaches into ${name}; import '${name}' (its public API) instead`,
        );
      } else if (!declared(name)) {
        add(
          'import-not-allowed',
          `${entry.package} may not import ${name}: it is not a declared dependency (the register allows ${entry.id} ${describeAllowed(context, new Set(isTest ? allDepends(entry) : entry.depends))})`,
        );
      }
      continue;
    }

    if (!declared(name)) {
      const onlyDev = !isTest && devDeclared.has(name);
      add(
        'undeclared-import',
        onlyDev
          ? `'${name}' is a development dependency; runtime code needs it in ${entry.path}/package.json dependencies`
          : `'${name}' is not declared in ${entry.path}/package.json`,
      );
    }
  }
  return violations;
}

// ---------------------------------------------------------------- helpers

function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const files: string[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (!SKIPPED_DIRS.has(dirent.name)) files.push(...listSourceFiles(path));
    } else if (dirent.isFile() && SOURCE_EXTENSIONS.has(extname(dirent.name))) {
      if (!dirent.name.endsWith('.d.ts')) files.push(path);
    }
  }
  return files.sort();
}

/** `@scope/name/sub` becomes `@scope/name`; `name/sub` becomes `name`. */
function packageNameOf(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

function describeAllowed(context: PackageContext, allowed: ReadonlySet<string>): string {
  const names = context.register.packages
    .filter((other) => allowed.has(other.id))
    .map((other) => other.package);
  return names.length > 0 ? `only ${names.join(', ')}` : 'no workspace dependencies';
}

function isInside(dir: string, target: string): boolean {
  const rel = relative(dir, target);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith(sep));
}

function toRepoPath(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join('/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sortViolations(violations: readonly Violation[]): Violation[] {
  return [...violations].sort(
    (a, b) =>
      (a.file ?? '').localeCompare(b.file ?? '') ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.rule.localeCompare(b.rule) ||
      a.message.localeCompare(b.message),
  );
}
