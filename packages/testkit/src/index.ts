/**
 * Public API of @gx/testkit. This is the only file other packages may import.
 * Capabilities arrive with the K0 tasks in docs/plans/001-foundation/K0-core.md.
 */
import { moduleId, type ModuleId } from '@gx/core';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('testkit');
