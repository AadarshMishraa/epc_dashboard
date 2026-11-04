/**
 * gx-migrate check | plan | up | forget-started <package/name>   [--root <dir>] [--url-env <NAME>]
 *
 * check  validate every migration file; no database needed (CI and pre-commit)
 * plan   list pending migrations against the database without applying them
 * up     apply pending migrations (GX_RELEASE, if set, is recorded with each)
 * forget-started  clear a no-transaction migration left `started` by a crash, after checking it
 *
 * The database URL is read from the environment variable named by --url-env
 * (default DATABASE_MIGRATION_URL) and is never printed.
 * Exit codes: 0 ok, 1 problems or a failed migration, 2 the command could not run.
 */
import { parseArgs } from 'node:util';
import {
  forgetStarted,
  loadMigrations,
  migrate,
  sourcesFromRegister,
  type MigrationProblem,
} from '../index.ts';

function print(problem: MigrationProblem): void {
  const where =
    problem.file === undefined
      ? '(migrations)'
      : problem.line === undefined
        ? problem.file
        : `${problem.file}:${String(problem.line)}`;
  console.error(`${where} [${problem.rule}] ${problem.message}`);
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    options: { root: { type: 'string' }, 'url-env': { type: 'string' } },
    allowPositionals: true,
    strict: true,
  });
  const [command] = positionals;
  if (
    command !== 'check' &&
    command !== 'plan' &&
    command !== 'up' &&
    command !== 'forget-started'
  ) {
    console.error(
      'usage: gx-migrate check | plan | up | forget-started <package/name> [--root <dir>] [--url-env <NAME>]',
    );
    return 2;
  }
  const sources = sourcesFromRegister(values.root ?? process.cwd());

  if (command === 'check') {
    const { migrations, problems } = loadMigrations(sources);
    problems.forEach(print);
    const summary = `migrations: ${String(migrations.length)} files, ${String(problems.length)} problems`;
    if (problems.length > 0) {
      console.error(summary);
      return 1;
    }
    console.log(summary);
    return 0;
  }

  const urlEnv = values['url-env'] ?? 'DATABASE_MIGRATION_URL';
  const connectionString = process.env[urlEnv];
  if (connectionString === undefined || connectionString === '') {
    console.error(`${urlEnv} is not set; it must hold the migration role's connection string`);
    return 2;
  }
  if (command === 'forget-started') {
    const target = positionals[1];
    if (target === undefined) {
      console.error('usage: gx-migrate forget-started <package/name>');
      return 2;
    }
    const forgotten = await forgetStarted(connectionString, target);
    if (forgotten.ok) {
      console.log(`cleared started row for ${target}`);
      return 0;
    }
    console.error(forgotten.error.message);
    return 1;
  }
  const release = process.env['GX_RELEASE'];
  const result = await migrate({
    connectionString,
    sources,
    dryRun: command === 'plan',
    ...(release === undefined || release === '' ? {} : { release }),
  });
  if (result.ok) {
    const { applied, pending, alreadyApplied } = result.value;
    if (command === 'plan') {
      for (const m of pending) console.log(`pending ${m.packageId}/${m.name}`);
      console.log(
        `plan: ${String(pending.length)} pending, ${String(alreadyApplied)} already applied`,
      );
    } else {
      for (const m of applied)
        console.log(`applied ${m.packageId}/${m.name} (${String(m.durationMs)} ms)`);
      console.log(
        `up: ${String(applied.length)} applied, ${String(alreadyApplied)} already applied`,
      );
    }
    return 0;
  }
  const failure = result.error;
  if (failure.kind === 'invalid' || failure.kind === 'ledger-mismatch')
    failure.problems.forEach(print);
  else if (failure.kind !== 'migration-failed') console.error(failure.message);
  else {
    console.error(
      `failed ${failure.packageId}/${failure.name} (SQLSTATE ${failure.sqlState ?? 'unknown'}): ${failure.message}`,
    );
    console.error(
      `${String(failure.applied.length)} migrations were applied before it; fix forward with a new migration`,
    );
  }
  return 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(
      `gx-migrate could not run: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 2;
  },
);
