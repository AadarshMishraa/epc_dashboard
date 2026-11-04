declare const moduleIdBrand: unique symbol;

/**
 * Id of a package in packages/register.json and of a module in its manifest
 * (docs/architecture/module-manifest.md): lowercase words joined by single hyphens,
 * digits allowed after the first letter, for example `core` or `k1-tenancy`.
 */
export type ModuleId = string & { readonly [moduleIdBrand]: true };

const MODULE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
/** Long enough for any descriptive id; short enough to stay readable in logs and table prefixes. */
export const MODULE_ID_MAX_LENGTH = 64;

export function isModuleId(value: unknown): value is ModuleId {
  return (
    typeof value === 'string' &&
    value.length <= MODULE_ID_MAX_LENGTH &&
    MODULE_ID_PATTERN.test(value)
  );
}

/**
 * Brands a module id that is written in code. An invalid id is a programming error,
 * so this throws instead of returning a failure value.
 */
export function moduleId(value: string): ModuleId {
  if (!isModuleId(value)) {
    throw new TypeError(
      `Invalid module id ${JSON.stringify(value)}: use lowercase words joined by hyphens, at most ${String(MODULE_ID_MAX_LENGTH)} characters`,
    );
  }
  return value;
}
