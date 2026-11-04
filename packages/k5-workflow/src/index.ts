/**
 * Public API of @gx/k5-workflow. This is the only file other packages may import.
 * Capabilities arrive with the K5 tasks in docs/plans/001-foundation/K5-workflow.md.
 */
import { moduleId, type ModuleId } from '@gx/core';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('k5-workflow');
