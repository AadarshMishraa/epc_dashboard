/**
 * Public API of @gx/k4-config. This is the only file other packages may import.
 * Capabilities arrive with the K4 tasks in docs/plans/001-foundation/K4-config.md.
 */
import { moduleId, type ModuleId } from '@gx/core';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('k4-config');
