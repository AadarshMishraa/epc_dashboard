import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MigrationSource } from './migrations.ts';

interface RegisterShape {
  readonly packages: readonly {
    readonly id: string;
    readonly path: string;
    readonly depends: readonly string[];
  }[];
}

function isRegister(value: unknown): value is RegisterShape {
  if (typeof value !== 'object' || value === null || !('packages' in value)) return false;
  const { packages } = value;
  return (
    Array.isArray(packages) &&
    packages.every(
      (entry: unknown) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        typeof (entry as { path?: unknown }).path === 'string' &&
        Array.isArray((entry as { depends?: unknown }).depends),
    )
  );
}

/**
 * One migration source per registered package: `<package>/migrations`, run after the
 * packages it depends on. The register's full validation is `pnpm check:imports`.
 */
export function sourcesFromRegister(root: string): MigrationSource[] {
  const raw: unknown = JSON.parse(readFileSync(join(root, 'packages/register.json'), 'utf8'));
  if (!isRegister(raw)) throw new Error('packages/register.json is not a valid register');
  return raw.packages.map((entry) => ({
    packageId: entry.id,
    dir: join(root, entry.path, 'migrations'),
    displayDir: `${entry.path}/migrations`,
    depends: entry.depends,
  }));
}
