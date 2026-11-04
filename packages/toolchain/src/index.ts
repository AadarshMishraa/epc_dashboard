/**
 * Public API of @gx/toolchain. This is the only file other packages may import.
 * The manifest validator (K0-T07), boundary lint (K0-T08) and public-API diff (K0-T09)
 * join the import-graph check here as they ship.
 */
import { moduleId, type ModuleId } from '@gx/core';

export {
  REGISTER_PATH,
  checkImportGraph,
  formatViolation,
  type ImportGraphOptions,
  type ImportGraphResult,
  type RuleId,
  type Violation,
} from './import-graph.ts';
export { findImports, type ImportReference } from './imports.ts';
export {
  parseRegister,
  type Register,
  type RegisterEntry,
  type RegisterParse,
} from './register.ts';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('toolchain');
