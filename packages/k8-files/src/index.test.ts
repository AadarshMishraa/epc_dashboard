import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODULE_ID } from './index.ts';

interface PackageJson {
  readonly name: string;
}
interface Register {
  readonly packages: readonly { readonly id: string; readonly package: string }[];
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
}

describe('@gx/k8-files public API', () => {
  it('exposes the id this package has in packages/register.json', () => {
    const { name } = readJson('../package.json') as PackageJson;
    const { packages } = readJson('../../register.json') as Register;
    const entry = packages.find((p) => p.package === name);
    expect(entry).toBeDefined();
    expect(MODULE_ID).toBe(entry?.id);
  });
});
