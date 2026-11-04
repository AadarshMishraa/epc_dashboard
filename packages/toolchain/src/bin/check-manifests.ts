/**
 * gx-check-manifests [--root <dir>]
 *
 * Exit codes: 0 every module manifest is valid, 1 problems found (each printed with its
 * file and the key or rule), 2 the check itself could not run.
 */
import { parseArgs } from 'node:util';
import { checkManifests } from '../index.ts';

function main(): number {
  const { values } = parseArgs({
    options: { root: { type: 'string' } },
    strict: true,
    allowPositionals: false,
  });
  const result = checkManifests({ root: values.root ?? process.cwd() });
  for (const problem of result.problems) console.error(`${problem.file}: ${problem.message}`);
  const summary = `manifests: ${String(result.manifestsChecked)} checked, ${String(result.problems.length)} problems`;
  if (result.problems.length > 0) {
    console.error(summary);
    return 1;
  }
  console.log(summary);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(
    `gx-check-manifests could not run: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 2;
}
