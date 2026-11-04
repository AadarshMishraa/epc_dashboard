/**
 * Public API of @gx/k1-tenancy. This is the only file other packages may import.
 * Capabilities arrive with the K1 tasks in docs/plans/001-foundation/K1-tenancy.md.
 */
import { moduleId, type ModuleId } from '@gx/core';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('k1-tenancy');
