import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateManifests, type ManifestInput, type ManifestProblem } from './manifest.ts';
import { parseRegister } from './register.ts';
import { REGISTER_PATH } from './import-graph.ts';

export const MANIFEST_FILE = 'manifest.json';

export interface ManifestCheckResult {
  readonly problems: readonly ManifestProblem[];
  readonly manifestsChecked: number;
}

/** Every `kind: module` package in the register must ship a valid manifest.json. */
export function checkManifests(options: { readonly root: string }): ManifestCheckResult {
  const { root } = options;
  const parsed = parseRegister(JSON.parse(readFileSync(join(root, REGISTER_PATH), 'utf8')));
  if (!parsed.ok) {
    return {
      problems: parsed.problems.map((message) => ({ file: REGISTER_PATH, message })),
      manifestsChecked: 0,
    };
  }
  const problems: ManifestProblem[] = [];
  const inputs: ManifestInput[] = [];
  for (const entry of parsed.register.packages.filter((p) => p.kind === 'module')) {
    const file = `${entry.path}/${MANIFEST_FILE}`;
    const path = join(root, file);
    if (!existsSync(path)) {
      problems.push({ file, message: `module ${entry.id} has no ${MANIFEST_FILE}` });
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      problems.push({
        file,
        message: `not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    const pkg = JSON.parse(readFileSync(join(root, entry.path, 'package.json'), 'utf8')) as {
      version?: unknown;
    };
    inputs.push({
      file,
      json,
      register: { id: entry.id, depends: entry.depends },
      packageVersion: typeof pkg.version === 'string' ? pkg.version : '',
    });
  }
  problems.push(...validateManifests(inputs));
  return { problems, manifestsChecked: inputs.length };
}
