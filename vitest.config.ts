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

// Two suites: unit tests (no I/O beyond the file system) run everywhere; database tests
// (`*.db.test.ts`) need GX_TEST_DATABASE_URL and run with `pnpm test:db` and in CI.
const databaseSuite = process.env['GX_TEST_SUITE'] === 'db';

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    projects: register.packages.map((entry) => ({
      extends: true,
      test: {
        name: entry.id,
        root: entry.path,
        include: databaseSuite ? ['src/**/*.db.test.ts'] : ['src/**/*.test.ts'],
        exclude: databaseSuite ? [] : ['src/**/*.db.test.ts'],
      },
    })),
    // In the database suite most packages have no database tests yet.
    passWithNoTests: databaseSuite,
    sequence: { shuffle: true },
  },
});
