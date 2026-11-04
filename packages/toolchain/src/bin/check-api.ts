/**
 * gx-check-api [--update] [--base <git-ref>] [--root <dir>]
 *
 * --update       rewrite every package's public-api.json from its source
 * --base <ref>   also compare with the reports at <ref> (CI: the pull request's base branch)
 *                and require a version bump that covers each change
 *
 * Exit codes: 0 ok, 1 problems (each printed as file: message), 2 the check could not run.
 */
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { checkApi } from '../index.ts';

/** A file at a git ref, or undefined when it does not exist there. */
function gitShow(root: string, ref: string, path: string): string | undefined {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // git exits non-zero when the path is not in that ref: the package is new there.
    return undefined;
  }
}

function main(): number {
  const { values } = parseArgs({
    options: { root: { type: 'string' }, base: { type: 'string' }, update: { type: 'boolean' } },
    strict: true,
    allowPositionals: false,
  });
  const root = values.root ?? process.cwd();
  const base = values.base;
  if (base !== undefined) {
    // Fail loudly on a bad ref instead of treating every package as new.
    execFileSync('git', ['rev-parse', '--verify', `${base}^{commit}`], {
      cwd: root,
      stdio: 'ignore',
    });
  }
  const result = checkApi({
    root,
    ...(values.update === true ? { update: true } : {}),
    ...(base === undefined ? {} : { readBase: (path: string) => gitShow(root, base, path) }),
  });
  for (const { package: name, changes } of result.changes) {
    for (const change of changes)
      console.log(`${name}: ${change.breaking ? 'BREAKING ' : ''}${change.detail}`);
  }
  for (const problem of result.problems) console.error(`${problem.file}: ${problem.message}`);
  const verb = values.update === true ? 'updated' : 'checked';
  const summary = `public API: ${String(result.packagesChecked)} packages ${verb}, ${String(result.problems.length)} problems`;
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
    `gx-check-api could not run: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 2;
}
