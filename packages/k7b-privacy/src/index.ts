/**
 * Public API of @gx/k7b-privacy. This is the only file other packages may import.
 * Capabilities arrive with the K7 tasks in docs/plans/001-foundation/K7-audit-privacy.md.
 */
import { moduleId, type ModuleId } from '@gx/core';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('k7b-privacy');
