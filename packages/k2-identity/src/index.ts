/**
 * Public API of @gx/k2-identity. This is the only file other packages may import.
 * Capabilities arrive with the K2 tasks in docs/plans/001-foundation/K2-identity.md.
 */
import { moduleId, type ModuleId } from '@gx/core';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('k2-identity');
