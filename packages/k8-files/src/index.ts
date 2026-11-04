/**
 * Public API of @gx/k8-files. This is the only file other packages may import.
 * Capabilities arrive with the K8 tasks in docs/plans/001-foundation/K8-files.md.
 */
import { moduleId, type ModuleId } from '@gx/core';

/** This package's id in packages/register.json. */
export const MODULE_ID: ModuleId = moduleId('k8-files');
