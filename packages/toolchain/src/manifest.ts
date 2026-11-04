import { CORE_ERRORS, ERROR_STATUSES, isModuleId } from '@gx/core';
import { z } from 'zod';

/**
 * Module manifest (docs/architecture/module-manifest.md). Every module ships one
 * `manifest.json`; the kernel reads manifests to wire permissions, events, AI tools,
 * settings and entitlements, so adding a module never means editing the kernel.
 */

const LAYERS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
export type Layer = (typeof LAYERS)[number];

const SNAKE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const moduleId = z
  .string()
  .refine(isModuleId, { message: 'must be lowercase words joined by hyphens' });
const entityName = z.string().regex(SNAKE, 'must be snake_case, for example invoice_line');
/** `entity.past_tense_verb`, for example `tenant.created`. */
const eventName = z
  .string()
  .regex(
    /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/,
    'must be entity.past_tense_verb, for example tenant.created',
  );
/** `entity.action`, for example `invoice.read`. */
const permissionName = z
  .string()
  .regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/, 'must be entity.action, for example invoice.read');
const toolName = z
  .string()
  .regex(SNAKE, 'must be a snake_case task name, for example receivables_due');

const errorDefinition = z.strictObject({
  status: z.literal([...ERROR_STATUSES]),
  message: z.string().trim().min(1),
  retryable: z.boolean(),
});

export const manifestSchema = z.strictObject({
  id: moduleId,
  layer: z.enum(LAYERS),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'must be a semantic version, for example 1.0.0'),
  depends: z.array(moduleId),
  /** Every table this module owns starts with this prefix; empty only for a module with no tables. */
  table_prefix: z
    .string()
    .regex(/^[a-z][a-z0-9]*_$/, 'must be lowercase letters and digits ending in _, for example k1_')
    .optional(),
  entities: z.array(entityName),
  events_emitted: z.array(eventName),
  events_consumed: z.array(eventName),
  permissions: z.array(permissionName),
  custom_field_hosts: z.array(entityName),
  workflow_hooks: z.array(permissionName),
  tools: z.array(
    z.strictObject({
      name: toolName,
      /** `read` or `draft`: anything that moves money, sends, issues or deletes is never a tool (ADR-0005). */
      mode: z.enum(['read', 'draft']),
      permission: permissionName,
    }),
  ),
  extension_points: z.array(
    z
      .string()
      .regex(/^[a-z][a-zA-Z0-9]*$/, 'must be camelCase, for example validateStageTransition'),
  ),
  config_schema: z.string().optional(),
  /** Error codes this module adds to the catalogue. */
  errors: z.record(
    z.string().regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/, 'must be UPPER_SNAKE_CASE'),
    errorDefinition,
  ),
  tests: z.array(
    z.enum(['tenant_isolation', 'permission', 'idempotency', 'immutability', 'pack_conformance']),
  ),
});

export type Manifest = z.infer<typeof manifestSchema>;

export interface ManifestProblem {
  /** Repository-relative manifest path. */
  readonly file: string;
  readonly message: string;
}

export interface ManifestInput {
  readonly file: string;
  readonly json: unknown;
  /** What the register says about this package. */
  readonly register: { readonly id: string; readonly depends: readonly string[] };
  readonly packageVersion: string;
}

type Parsed = { readonly file: string; readonly manifest: Manifest; readonly input: ManifestInput };

/**
 * Validates each manifest's shape (unknown keys are named), then checks them against the
 * register and against each other: depends match, layering points down, every consumed
 * event is emitted by someone, every tool's permission is declared, and no error code is
 * declared twice or shadows a core code.
 */
export function validateManifests(inputs: readonly ManifestInput[]): ManifestProblem[] {
  const problems: ManifestProblem[] = [];
  const parsed: Parsed[] = [];
  for (const input of inputs) {
    const result = manifestSchema.safeParse(input.json);
    if (result.success) parsed.push({ file: input.file, manifest: result.data, input });
    else {
      for (const issue of result.error.issues) {
        const where = issue.path.length > 0 ? issue.path.join('.') : '(root)';
        const keys =
          issue.code === 'unrecognized_keys'
            ? ` ${issue.keys.map((k) => `'${k}'`).join(', ')}`
            : '';
        problems.push({ file: input.file, message: `${where}: ${issue.message}${keys}` });
      }
    }
  }
  problems.push(...crossCheck(parsed));
  return problems;
}

function crossCheck(parsed: readonly Parsed[]): ManifestProblem[] {
  const problems: ManifestProblem[] = [];
  const byId = new Map(parsed.map((p) => [p.manifest.id, p]));
  const emitted = new Set(parsed.flatMap((p) => p.manifest.events_emitted));
  const permissions = new Set(parsed.flatMap((p) => p.manifest.permissions));
  const errorOwners = new Map<string, string>(
    Object.keys(CORE_ERRORS).map((code) => [code, 'core']),
  );
  const prefixOwners = new Map<string, string>();
  const eventOwners = new Map<string, string>();
  const permissionOwners = new Map<string, string>();

  for (const { file, manifest, input } of parsed) {
    const add = (message: string): void => {
      problems.push({ file, message });
    };
    if (manifest.id !== input.register.id)
      add(`id is ${manifest.id}, but the register entry is ${input.register.id}`);
    if (manifest.version !== input.packageVersion) {
      add(`version ${manifest.version} differs from package.json version ${input.packageVersion}`);
    }
    const registered = [...input.register.depends].sort().join(',');
    if ([...manifest.depends].sort().join(',') !== registered) {
      add(
        `depends [${manifest.depends.join(', ')}] differs from the register's [${input.register.depends.join(', ')}]`,
      );
    }
    for (const dep of manifest.depends) {
      const target = byId.get(dep);
      if (target !== undefined && target.manifest.layer > manifest.layer) {
        add(`depends on ${dep} in ${target.manifest.layer}, a higher layer than ${manifest.layer}`);
      }
    }
    for (const host of manifest.custom_field_hosts) {
      if (!manifest.entities.includes(host))
        add(`custom_field_hosts names ${host}, which is not in entities`);
    }
    for (const event of manifest.events_consumed) {
      if (!emitted.has(event)) add(`consumes ${event}, which no manifest emits`);
    }
    for (const event of manifest.events_emitted) {
      claim(eventOwners, event, manifest.id, `emits ${event}`, add);
      const [entity] = event.split('.');
      if (entity !== undefined && !manifest.entities.includes(entity)) {
        add(`emits ${event}, but ${entity} is not one of its entities`);
      }
    }
    for (const permission of manifest.permissions) {
      claim(permissionOwners, permission, manifest.id, `declares permission ${permission}`, add);
    }
    for (const tool of manifest.tools) {
      if (!permissions.has(tool.permission))
        add(`tool ${tool.name} needs permission ${tool.permission}, which no manifest declares`);
    }
    for (const code of Object.keys(manifest.errors)) {
      claim(errorOwners, code, manifest.id, `declares error code ${code}`, add);
    }
    if (manifest.table_prefix !== undefined) {
      claim(
        prefixOwners,
        manifest.table_prefix,
        manifest.id,
        `uses table prefix ${manifest.table_prefix}`,
        add,
      );
    } else if (manifest.entities.length > 0) {
      add('declares entities but no table_prefix');
    }
  }
  return problems;
}

/** Records the first owner of a name; a second module claiming it is a problem. */
function claim(
  owners: Map<string, string>,
  name: string,
  claimant: string,
  what: string,
  add: (message: string) => void,
): void {
  const owner = owners.get(name);
  if (owner === undefined) owners.set(name, claimant);
  else if (owner !== claimant) add(`${what}, already owned by ${owner}`);
}
