import { isModuleId } from '@gx/core';
import { z } from 'zod';

const moduleIdSchema = z.string().refine(isModuleId, {
  message: 'must be lowercase words joined by hyphens (for example k1-tenancy)',
});

const registerEntrySchema = z.strictObject({
  id: moduleIdSchema,
  package: z.string(),
  path: z.string(),
  kind: z.enum(['module', 'support']),
  plan: z.string().regex(/^K[0-8]$/, 'must name a foundation plan brief, K0 to K8'),
  purpose: z.string().min(1),
  /** Workspace packages this package may use at runtime (dependencies). */
  depends: z.array(moduleIdSchema),
  /** Extra workspace packages its tests may use (devDependencies). */
  devDepends: z.array(moduleIdSchema).optional(),
  /** No dependencies and no Node.js I/O outside tests (core). */
  isolated: z.literal(true).optional(),
});

const registerSchema = z.strictObject({
  description: z.string().optional(),
  packages: z.array(registerEntrySchema).min(1),
});

export type RegisterEntry = z.infer<typeof registerEntrySchema>;
export interface Register {
  readonly packages: readonly RegisterEntry[];
}

export type RegisterParse =
  | { readonly ok: true; readonly register: Register }
  | { readonly ok: false; readonly problems: readonly string[] };

/**
 * Validates the register's shape and its internal consistency: unique ids, the naming
 * convention (`@gx/<id>` in `packages/<id>`), known dependency ids and no cycles.
 */
export function parseRegister(input: unknown): RegisterParse {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) => {
        const where = issue.path.length > 0 ? issue.path.join('.') : '(root)';
        return `${where}: ${issue.message}`;
      }),
    };
  }
  const { packages } = parsed.data;
  const problems = [...namingProblems(packages), ...dependencyProblems(packages)];
  return problems.length > 0 ? { ok: false, problems } : { ok: true, register: { packages } };
}

function namingProblems(packages: readonly RegisterEntry[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of packages) {
    if (seen.has(entry.id)) problems.push(`duplicate id ${entry.id}`);
    seen.add(entry.id);
    if (entry.package !== `@gx/${entry.id}`) {
      problems.push(`${entry.id}: package must be @gx/${entry.id}, found ${entry.package}`);
    }
    if (entry.path !== `packages/${entry.id}`) {
      problems.push(`${entry.id}: path must be packages/${entry.id}, found ${entry.path}`);
    }
  }
  return problems;
}

function dependencyProblems(packages: readonly RegisterEntry[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>(packages.map((entry) => entry.id));
  for (const entry of packages) {
    for (const dep of allDepends(entry)) {
      if (dep === entry.id) problems.push(`${entry.id}: depends on itself`);
      else if (!ids.has(dep)) problems.push(`${entry.id}: depends on unknown id ${dep}`);
    }
  }
  const cycle = findCycle(packages);
  if (cycle !== undefined) problems.push(`dependency cycle: ${cycle.join(' -> ')}`);
  return problems;
}

/** Runtime and test dependencies together; a cycle through either breaks the build order. */
export function allDepends(entry: RegisterEntry): readonly string[] {
  return [...entry.depends, ...(entry.devDepends ?? [])];
}

function findCycle(packages: readonly RegisterEntry[]): string[] | undefined {
  const byId = new Map<string, RegisterEntry>(packages.map((entry) => [entry.id, entry]));
  const done = new Set<string>();
  const stack: string[] = [];

  const visit = (id: string): string[] | undefined => {
    const open = stack.indexOf(id);
    if (open !== -1) return [...stack.slice(open), id];
    if (done.has(id)) return undefined;
    stack.push(id);
    const entry = byId.get(id);
    for (const dep of entry === undefined ? [] : allDepends(entry)) {
      if (dep === id) continue; // reported as "depends on itself"
      const cycle = visit(dep);
      if (cycle !== undefined) return cycle;
    }
    stack.pop();
    done.add(id);
    return undefined;
  };

  for (const entry of packages) {
    const cycle = visit(entry.id);
    if (cycle !== undefined) return cycle;
  }
  return undefined;
}
