/**
 * gx-check-imports [--root <dir>]
 *
 * Exit codes: 0 the import graph is clean, 1 violations found (each printed with its
 * file, line and rule), 2 the check itself could not run.
 */
import { parseArgs } from 'node:util';
import { checkImportGraph, formatViolation } from '../index.ts';

function main(): number {
  const { values } = parseArgs({
    options: { root: { type: 'string' } },
    strict: true,
    allowPositionals: false,
  });
  const result = checkImportGraph({ root: values.root ?? process.cwd() });
  for (const violation of result.violations) {
    console.error(formatViolation(violation));
  }
  const summary = `import graph: ${String(result.packagesChecked)} packages, ${String(result.filesChecked)} files, ${String(result.violations.length)} violations`;
  if (result.violations.length > 0) {
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
    `gx-check-imports could not run: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 2;
}
