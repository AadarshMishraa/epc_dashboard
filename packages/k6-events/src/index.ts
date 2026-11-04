/**
 * Public API of @gx/k6-events. This is the only file other packages may import.
 * Capabilities arrive with the K6 tasks in docs/plans/001-foundation/K6-events.md.
 */
import { moduleId, type ModuleId } from '@gx/core';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('k6-events');
