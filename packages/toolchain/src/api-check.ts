import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  bumpBetween,
  bumpSatisfies,
  diffApi,
  extractApi,
  parseVersion,
  requiredBump,
  type ApiChange,
  type ApiReport,
} from './api-report.ts';
import { REGISTER_PATH } from './import-graph.ts';
import { parseRegister } from './register.ts';

export const API_REPORT_FILE = 'public-api.json';

export interface ApiProblem {
  readonly file: string;
  readonly message: string;
}

export interface ApiCheckOptions {
  readonly root: string;
  /** Write fresh reports instead of checking them. */
  readonly update?: boolean;
  /**
   * The base branch's report for a package path (`packages/core/public-api.json`), or
   * undefined when the package is new there. Without it, only the committed report is checked.
   */
  readonly readBase?: (reportPath: string) => string | undefined;
}

export interface ApiCheckResult {
  readonly problems: readonly ApiProblem[];
  readonly changes: readonly { readonly package: string; readonly changes: readonly ApiChange[] }[];
  readonly packagesChecked: number;
}

/**
 * For every registered package: the committed report must match the public API as it
 * is now, its version must match package.json, and, against the base branch, the version
 * bump must cover the change (break: major, or minor before 1.0.0; addition: minor, or patch).
 */
export function checkApi(options: ApiCheckOptions): ApiCheckResult {
  const { root } = options;
  const parsed = parseRegister(JSON.parse(readFileSync(join(root, REGISTER_PATH), 'utf8')));
  if (!parsed.ok) {
    return {
      problems: parsed.problems.map((message) => ({ file: REGISTER_PATH, message })),
      changes: [],
      packagesChecked: 0,
    };
  }
  const problems: ApiProblem[] = [];
  const changes: { package: string; changes: ApiChange[] }[] = [];
  let packagesChecked = 0;

  for (const entry of parsed.register.packages) {
    const reportPath = `${entry.path}/${API_REPORT_FILE}`;
    const add = (message: string): void => {
      problems.push({ file: reportPath, message });
    };
    const pkg = JSON.parse(readFileSync(join(root, entry.path, 'package.json'), 'utf8')) as {
      version?: unknown;
    };
    const version = typeof pkg.version === 'string' ? pkg.version : '';
    const current: ApiReport = {
      package: entry.package,
      version,
      exports: extractApi({
        tsconfigPath: join(root, entry.path, 'tsconfig.json'),
        entry: join(root, entry.path, 'src/index.ts'),
      }),
    };
    packagesChecked += 1;

    if (options.update === true) {
      writeFileSync(join(root, reportPath), `${JSON.stringify(current, null, 2)}\n`);
      continue;
    }
    if (!existsSync(join(root, reportPath))) {
      add(`no ${API_REPORT_FILE}; run pnpm api:update and commit it`);
      continue;
    }
    const committed = JSON.parse(readFileSync(join(root, reportPath), 'utf8')) as ApiReport;
    const drift = diffApi(committed.exports, current.exports);
    if (drift.length > 0) {
      add(
        `the public API changed but the report did not (${drift.map((c) => c.detail).join('; ')}); run pnpm api:update, bump the version and update the changelog`,
      );
    }
    if (committed.version !== version) {
      add(
        `report version ${committed.version} differs from package.json ${version}; run pnpm api:update`,
      );
    }

    const baseText = options.readBase?.(reportPath);
    if (baseText === undefined) continue;
    const base = JSON.parse(baseText) as ApiReport;
    const baseVersion = parseVersion(base.version);
    const currentVersion = parseVersion(version);
    if (baseVersion === undefined || currentVersion === undefined) {
      add(`cannot compare versions ${base.version} and ${version}`);
      continue;
    }
    const sinceBase = diffApi(base.exports, current.exports);
    if (sinceBase.length > 0) changes.push({ package: entry.package, changes: sinceBase });
    const actual = bumpBetween(baseVersion, currentVersion);
    if (actual === 'downgrade') {
      add(`version went back from ${base.version} to ${version}`);
      continue;
    }
    const required = requiredBump(sinceBase, baseVersion);
    if (!bumpSatisfies(actual, required)) {
      const why = sinceBase.filter(
        (c) => required === 'none' || c.breaking || !sinceBase.some((x) => x.breaking),
      );
      add(
        `${entry.package} ${base.version} -> ${version} is a ${actual} bump, but the API change needs at least ${required}: ${why.map((c) => c.detail).join('; ')}`,
      );
    }
  }
  return { problems, changes, packagesChecked };
}
