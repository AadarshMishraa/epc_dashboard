import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { REGISTER_PATH } from './import-graph.ts';
import { validateManifests, type ManifestInput, type ManifestProblem } from './manifest.ts';
import { parseRegister } from './register.ts';

export const MANIFEST_FILE = 'manifest.json';
/** Where manifests are found: foundation packages, and any module inside a pack. */
const SEARCH_ROOTS = ['packages', 'packs'] as const;
const SKIPPED = new Set(['node_modules', 'dist', '.turbo', 'docs']);

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

  for (const manifestPath of SEARCH_ROOTS.flatMap((dir) => findManifests(join(root, dir)))) {
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
        requiredLayer: 'L0',
        fileExists,
      });
    } else {
      inputs.push({ file, json, fileExists });
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

function findManifests(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const results: string[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    if (dirent.isDirectory() && !SKIPPED.has(dirent.name))
      results.push(...findManifests(join(dir, dirent.name)));
    else if (dirent.isFile() && dirent.name === MANIFEST_FILE) results.push(join(dir, dirent.name));
  }
  return results.sort();
}

function readVersion(packageJsonPath: string): string {
  if (!existsSync(packageJsonPath)) return '';
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: unknown };
  return typeof pkg.version === 'string' ? pkg.version : '';
}
