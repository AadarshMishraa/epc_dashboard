import { readFileSync } from 'node:fs';
import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

// One test project per registered package, so the register stays the only package list.
interface RegisterEntry {
  readonly id: string;
  readonly path: string;
}

const register = JSON.parse(readFileSync('packages/register.json', 'utf8')) as {
  readonly packages: readonly RegisterEntry[];
};

// Workspace packages export an `@gx/source` condition that points at src/index.ts,
// so tests run against source without a prior build.
const conditions = ['@gx/source', ...defaultServerConditions];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    projects: register.packages.map((entry) => ({
      extends: true,
      test: {
        name: entry.id,
        root: entry.path,
        include: ['src/**/*.test.ts'],
      },
    })),
    passWithNoTests: false,
    sequence: { shuffle: true },
  },
});
