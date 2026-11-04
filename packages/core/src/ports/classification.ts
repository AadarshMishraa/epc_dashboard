/** Data classes, least to most restrictive (security guidelines 2). */
export const DATA_CLASSES = [
  'public',
  'internal',
  'personal',
  'sensitive_personal',
  'secret',
] as const;
export type DataClass = (typeof DATA_CLASSES)[number];

/**
 * The classification of a field, which drives masking, logging, export, retention and
 * erasure. An unknown field is `secret`, the most restrictive class, never public.
 * Synchronous, so the logger can redact on the hot path; adapters preload. Implemented by K4.
 */
export interface ClassificationLookup {
  classify(entity: string, field: string): DataClass;
}

/** True when `a` is at least as restrictive as `b`. */
export function atLeast(a: DataClass, b: DataClass): boolean {
  return DATA_CLASSES.indexOf(a) >= DATA_CLASSES.indexOf(b);
}
