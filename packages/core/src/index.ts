/**
 * Public API of @gx/core. This is the only file other packages may import.
 * Core has no I/O and no dependencies. Context, ids, errors, Result, Clock and the
 * core ports arrive with the K0 tasks in docs/plans/001-foundation/K0-core.md.
 */
import { moduleId, type ModuleId } from './module-id.ts';

export { MODULE_ID_MAX_LENGTH, isModuleId, moduleId, type ModuleId } from './module-id.ts';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('core');
