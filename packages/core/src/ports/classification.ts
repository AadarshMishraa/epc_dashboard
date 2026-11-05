import type { Context } from '../context.ts';

/** Data classes from the security guidelines, least to most restrictive. */
export const CLASSIFICATIONS = Object.freeze([
  'public',
  'internal',
  'personal',
  'sensitive_personal',
  'secret',
] as const);
export type Classification = (typeof CLASSIFICATIONS)[number];

export interface FieldRef {
  /** Entity name, snake_case, as in the owning module's manifest. */
  readonly entity: string;
  readonly field: string;
}

/**
 * The classification of a field, which drives masking in logs, diffs and exports. A field
 * the lookup does not know is `secret`, the most restrictive class, never `public`.
 * Global for fields declared in manifests; with a tenant in the context it also answers for
 * that tenant's custom fields (K4). Synchronous, because log redaction cannot wait.
 * Call it through `classifyField`.
 */
export interface ClassificationLookup {
  classify(context: Context, field: FieldRef): Classification;
}

export function isClassification(value: unknown): value is Classification {
  return (CLASSIFICATIONS as readonly unknown[]).includes(value);
}

/**
 * Asks the lookup and fails closed: a throw or an unknown answer is `secret`. `onError`
 * receives the cause, so the failure can be reported instead of lost.
 */
export function classifyField(
  lookup: ClassificationLookup,
  context: Context,
  field: FieldRef,
  onError?: (cause: unknown) => void,
): Classification {
  try {
    const classification = lookup.classify(context, field);
    return isClassification(classification) ? classification : 'secret';
  } catch (cause) {
    onError?.(cause);
    return 'secret';
  }
}
