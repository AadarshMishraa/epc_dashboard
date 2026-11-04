import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  API_REPORT_FORMAT,
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
   * The base branch's report for a package, looked up by package name, or undefined when
   * the package does not exist there. Any other failure must throw, never return undefined.
   */
  readonly readBase?: (packageName: string) => string | undefined;
  /** Accept a base report written in an older report format (a toolchain change). */
  readonly allowFormatChange?: boolean;
}

export interface ApiCheckResult {
  readonly problems: readonly ApiProblem[];
  readonly changes: readonly { readonly package: string; readonly changes: readonly ApiChange[] }[];
  /** Packages compared with nothing, because they are new on the base branch. */
  readonly newPackages: readonly string[];
  readonly packagesChecked: number;
}

/**
 * For every registered package: no forgotten exports or `any` in its public API; the
 * committed report matches the source and package.json; and, against the base branch,
 * the version bump covers the change.
 */
export function checkApi(options: ApiCheckOptions): ApiCheckResult {
  const { root } = options;
  const parsed = parseRegister(JSON.parse(readFileSync(join(root, REGISTER_PATH), 'utf8')));
  if (!parsed.ok) {
    return {
      problems: parsed.problems.map((message) => ({ file: REGISTER_PATH, message })),
      changes: [],
      newPackages: [],
      packagesChecked: 0,
    };
  }
  const problems: ApiProblem[] = [];
  const changes: { package: string; changes: ApiChange[] }[] = [];
  const newPackages: string[] = [];
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
    const extraction = extractApi({
      tsconfigPath: join(root, entry.path, 'tsconfig.json'),
      entry: join(root, entry.path, 'src/index.ts'),
    });
    for (const message of extraction.problems) {
      problems.push({ file: `${entry.path}/src/index.ts`, message });
    }
    const current: ApiReport = {
      format: API_REPORT_FORMAT,
      package: entry.package,
      version,
      exports: extraction.exports,
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
    if (committed.format !== API_REPORT_FORMAT) {
      add(
        `report format ${String(committed.format)} is not ${String(API_REPORT_FORMAT)}; run pnpm api:update`,
      );
      continue;
    }
    const drift = diffApi(committed.exports, current.exports);
    if (drift.length > 0) {
      add(
        `the public API changed but the report did not (${drift.map((c) => c.detail).join('; ')}); run pnpm api:update, bump the version if needed and update the changelog`,
      );
    }
    if (committed.version !== version) {
      add(
        `report version ${committed.version} differs from package.json ${version}; run pnpm api:update`,
      );
    }

    if (options.readBase === undefined) continue;
    const baseText = options.readBase(entry.package);
    if (baseText === undefined) {
      newPackages.push(entry.package);
      continue;
    }
    const base = JSON.parse(baseText) as ApiReport;
    if (base.format !== API_REPORT_FORMAT) {
      if (options.allowFormatChange !== true) {
        add(
          `the base report uses format ${String(base.format)} and this one ${String(API_REPORT_FORMAT)}, so the API cannot be compared; review the report diff by hand and rerun with --allow-format-change`,
        );
      }
      continue;
    }
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
      const breaking = sinceBase.filter((c) => c.breaking);
      const why = breaking.length > 0 ? breaking : sinceBase;
      add(
        `${entry.package} ${base.version} -> ${version} is a ${actual} bump, but the API change needs at least ${required}: ${why.map((c) => c.detail).join('; ')}`,
      );
    }
  }
  return { problems, changes, newPackages, packagesChecked };
}
