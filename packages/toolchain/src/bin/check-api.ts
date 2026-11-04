/**
 * gx-check-api [--update] [--base <git-ref>] [--allow-format-change] [--root <dir>]
 *
 * --update               rewrite every package's public-api.json from its source
 * --base <ref>           also compare with the reports at the merge-base of <ref> and HEAD
 *                        (CI: the pull request's base branch; fetch enough history for it)
 *                        and require a version bump that covers each change
 * --allow-format-change  accept base reports written in an older report format
 *
 * Exit codes: 0 ok, 1 problems (each printed as file: message), 2 the check could not run.
 */
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { API_REPORT_FILE, REGISTER_PATH, checkApi } from '../index.ts';

const git = (root: string, args: readonly string[]): string =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** A file at a commit, or undefined when the path does not exist there. Other git errors throw. */
function fileAt(root: string, commit: string, path: string): string | undefined {
  if (git(root, ['ls-tree', '--name-only', commit, '--', path]).trim() === '') return undefined;
  return git(root, ['show', `${commit}:${path}`]);
}

/** Reads base reports by package name through the base commit's own register. */
function baseReader(root: string, ref: string): (packageName: string) => string | undefined {
  const head = git(root, ['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  const target = git(root, ['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  const mergeBase = git(root, ['merge-base', target, head]).trim();
  const registerText = fileAt(root, mergeBase, REGISTER_PATH);
  const paths = new Map<string, string>();
  if (registerText !== undefined) {
    const register = JSON.parse(registerText) as {
      packages?: { package?: unknown; path?: unknown }[];
    };
    for (const entry of register.packages ?? []) {
      if (typeof entry.package === 'string' && typeof entry.path === 'string')
        paths.set(entry.package, entry.path);
    }
  }
  return (packageName) => {
    const path = paths.get(packageName);
    return path === undefined ? undefined : fileAt(root, mergeBase, `${path}/${API_REPORT_FILE}`);
  };
}

function main(): number {
  const { values } = parseArgs({
    options: {
      root: { type: 'string' },
      base: { type: 'string' },
      update: { type: 'boolean' },
      'allow-format-change': { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  const root = values.root ?? process.cwd();
  const result = checkApi({
    root,
    ...(values.update === true ? { update: true } : {}),
    ...(values['allow-format-change'] === true ? { allowFormatChange: true } : {}),
    ...(values.base === undefined ? {} : { readBase: baseReader(root, values.base) }),
  });
  for (const { package: name, changes } of result.changes) {
    for (const change of changes)
      console.log(`${name}: ${change.breaking ? 'BREAKING ' : ''}${change.detail}`);
  }
  for (const name of result.newPackages) console.log(`${name}: new since the base, not compared`);
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
