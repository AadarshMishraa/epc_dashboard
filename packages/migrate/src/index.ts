/**
 * Public API of @gx/migrate. This is the only file other packages may import.
 * Package-namespaced, forward-only, expand-then-contract migrations in dependency order.
 */
import { moduleId, type ModuleId } from '@gx/core';

export {
  loadMigrations,
  type LoadedMigrations,
  type Migration,
  type MigrationProblem,
  type MigrationSource,
  type Phase,
  type ProblemRule,
} from './migrations.ts';
export {
  LEDGER_TABLE,
  LEDGER_VERSION,
  MIGRATION_LOCK_KEY,
  forgetStarted,
  migrate,
  type AppliedMigration,
  type MigrateFailure,
  type MigrateOptions,
  type MigrateReport,
} from './runner.ts';
export {
  KNOWN_ROLES,
  blankCommentsAndStrings,
  countStatements,
  findRiskyStatements,
  splitStatements,
  type Finding,
  type Severity,
  type Statement,
} from './sql-scan.ts';
export { sourcesFromRegister } from './sources.ts';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('migrate');
