/**
 * Public API of @gx/k3-entitlements. This is the only file other packages may import.
 * Capabilities arrive with the K3 tasks in docs/plans/001-foundation/K3-entitlements.md.
 */
import { moduleId, type ModuleId } from '@gx/core';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('k3-entitlements');
