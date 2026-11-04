import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { REGISTER_PATH } from './import-graph.ts';
import { validateManifests, type ManifestInput, type ManifestProblem } from './manifest.ts';
import { parseRegister } from './register.ts';

export const MANIFEST_FILE = 'manifest.json';
/**
 * Where module manifests live: `packages/<id>/manifest.json` and
 * `packs/<pack>/modules/<module>/manifest.json`. Nothing deeper, so a web app manifest
 * or a test fixture is never mistaken for a module.
 */
const MANIFEST_LOCATIONS: readonly (readonly string[])[] = [
  ['packages', '*'],
  ['packs', '*', 'modules', '*'],
];

export interface ManifestCheckResult {
  readonly problems: readonly ManifestProblem[];
  readonly manifestsChecked: number;
}

/**
 * Finds every manifest.json under packages/ and packs/. Foundation manifests must match
 * their register entry and be L0, and every `kind: module` package must have one.
 * Manifests elsewhere (packs, modules declared by manifest only) need no foundation edit:
 * the manifest set is their source of truth.
 */
export function checkManifests(options: { readonly root: string }): ManifestCheckResult {
  const { root } = options;
  const parsed = parseRegister(JSON.parse(readFileSync(join(root, REGISTER_PATH), 'utf8')));
  if (!parsed.ok) {
    return {
      problems: parsed.problems.map((message) => ({ file: REGISTER_PATH, message })),
      manifestsChecked: 0,
    };
  }
  const byPath = new Map(parsed.register.packages.map((entry) => [entry.path, entry]));
  const problems: ManifestProblem[] = [];
  const inputs: ManifestInput[] = [];
  const found = new Set<string>();

  for (const manifestPath of MANIFEST_LOCATIONS.flatMap((pattern) =>
    findManifests(root, pattern),
  )) {
    const file = relative(root, manifestPath).split(sep).join('/');
    const packageDir = file.slice(0, -`/${MANIFEST_FILE}`.length);
    found.add(packageDir);
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (error) {
      problems.push({
        file,
        message: `not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    const fileExists = (relativePath: string): boolean =>
      existsSync(join(root, packageDir, relativePath));
    const entry = byPath.get(packageDir);
    if (packageDir.startsWith('packages/')) {
      if (entry === undefined) {
        problems.push({
          file,
          message: `${packageDir} has a manifest but no entry in ${REGISTER_PATH}`,
        });
        continue;
      }
      if (entry.kind !== 'module') {
        problems.push({
          file,
          message: `${entry.id} is a support package; only modules have manifests`,
        });
        continue;
      }
      inputs.push({
        file,
        json,
        register: { id: entry.id, depends: entry.depends },
        packageVersion: readVersion(join(root, packageDir, 'package.json')),
        allowedLayers: ['L0'],
        fileExists,
      });
    } else {
      inputs.push({ file, json, fileExists, allowedLayers: ['L3', 'L4'] });
    }
  }
  for (const entry of parsed.register.packages.filter((p) => p.kind === 'module')) {
    if (!found.has(entry.path))
      problems.push({
        file: `${entry.path}/${MANIFEST_FILE}`,
        message: `module ${entry.id} has no ${MANIFEST_FILE}`,
      });
  }
  problems.push(...validateManifests(inputs));
  return { problems, manifestsChecked: inputs.length };
}

/** Expands a path pattern whose `*` segments match one directory level each. */
function findManifests(root: string, pattern: readonly string[]): string[] {
  let dirs = [root];
  for (const segment of pattern) {
    dirs = dirs.flatMap((dir) => {
      if (segment !== '*') return existsSync(join(dir, segment)) ? [join(dir, segment)] : [];
      if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
      return readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
        .map((d) => join(dir, d.name));
    });
  }
  return dirs
    .map((dir) => join(dir, MANIFEST_FILE))
    .filter((path) => existsSync(path))
    .sort();
}

function readVersion(packageJsonPath: string): string {
  if (!existsSync(packageJsonPath)) return '';
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: unknown };
  return typeof pkg.version === 'string' ? pkg.version : '';
}
