import { CORE_ERRORS, ERROR_STATUSES, isModuleId } from '@gx/core';
import { z } from 'zod';

/**
 * Module manifest (docs/architecture/module-manifest.md). Every module ships one
 * `manifest.json`; the kernel reads manifests to wire permissions, events, AI tools,
 * settings and entitlements, so adding a module never means editing the kernel.
 *
 * Entities are the unit of ownership: each entity belongs to one module, and every
 * permission, workflow hook, event and custom-field host names one of the module's own
 * entities. That scopes `invoice.read` to whoever owns `invoice`, with no prefixes.
 */

const LAYERS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
export type Layer = (typeof LAYERS)[number];

const SNAKE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const DOTTED = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

function unique<T extends z.ZodType>(item: T, what: string) {
  return z
    .array(item)
    .refine((list) => new Set(list.map((x) => JSON.stringify(x))).size === list.length, {
      message: `lists a ${what} more than once`,
    });
}

const moduleId = z
  .string()
  .refine(isModuleId, { message: 'must be lowercase words joined by hyphens' });
const entityName = z.string().regex(SNAKE, 'must be snake_case, for example invoice_line');
const eventName = z
  .string()
  .regex(DOTTED, 'must be entity.past_tense_verb, for example tenant.created');
const permissionName = z.string().regex(DOTTED, 'must be entity.action, for example invoice.read');

const errorDefinition = z.strictObject({
  status: z.literal([...ERROR_STATUSES]),
  message: z.string().trim().min(1),
  retryable: z.boolean(),
});

export const manifestSchema = z.strictObject({
  id: moduleId,
  /** L0 kernel, L1 platform, L2 shared business, L3 domain, L4 pack. Foundation packages are L0. */
  layer: z.enum(LAYERS),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'must be a semantic version, for example 1.0.0'),
  depends: unique(moduleId, 'dependency'),
  /** Every table this module owns starts with this prefix. Required once it has entities. */
  table_prefix: z
    .string()
    .regex(/^[a-z][a-z0-9]*_$/, 'must be lowercase letters and digits ending in _, for example k1_')
    .optional(),
  entities: unique(entityName, 'entity'),
  /** Versioned contracts (K6-T01): add fields freely, never remove or rename; a break is a new version. */
  events_emitted: unique(
    z.strictObject({
      name: eventName,
      version: z.number().int().min(1),
      /** Payload schema, relative to the package; it marks classified fields. */
      schema: z.string().min(1),
    }),
    'event',
  ),
  events_consumed: unique(
    z.strictObject({ name: eventName, version: z.number().int().min(1) }),
    'consumed event',
  ),
  permissions: unique(permissionName, 'permission'),
  custom_field_hosts: unique(entityName, 'custom field host'),
  workflow_hooks: unique(permissionName, 'workflow hook'),
  tools: unique(
    z.strictObject({
      name: z.string().regex(SNAKE, 'must be a snake_case task name, for example receivables_due'),
      /** `read` or `draft`: anything that moves money, sends, issues or deletes is never a tool (ADR-0005). */
      mode: z.enum(['read', 'draft']),
      permission: permissionName,
    }),
    'tool',
  ),
  extension_points: unique(
    z
      .string()
      .regex(/^[a-z][a-zA-Z0-9]*$/, 'must be camelCase, for example validateStageTransition'),
    'extension point',
  ),
  config_schema: z.string().optional(),
  /** Error codes this module adds to the catalogue. */
  errors: z.record(
    z.string().regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/, 'must be UPPER_SNAKE_CASE'),
    errorDefinition,
  ),
  /** Test kinds the module intends to ship. Declared, not yet enforced (K0-T10 wires them into CI). */
  tests_planned: unique(
    z.enum(['tenant_isolation', 'permission', 'idempotency', 'immutability', 'pack_conformance']),
    'test',
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
  /**
   * The register entry, for a foundation package. Absent for a pack or a module declared
   * by manifest only; then the manifest set itself is the source of truth.
   */
  readonly register?: { readonly id: string; readonly depends: readonly string[] };
  readonly packageVersion?: string;
  /** Layer the manifest's location requires (L0 for foundation packages). */
  readonly requiredLayer?: Layer;
  /** Checks that a path declared by the manifest exists, relative to its package. */
  readonly fileExists?: (relativePath: string) => boolean;
}

type Parsed = { readonly manifest: Manifest; readonly input: ManifestInput };

/**
 * Validates each manifest's shape (unknown keys are named), then cross-checks the set.
 * Cross-checks run only when every manifest parses, so one broken file does not cascade
 * into errors about the others.
 */
export function validateManifests(inputs: readonly ManifestInput[]): ManifestProblem[] {
  const problems: ManifestProblem[] = [];
  const parsed: Parsed[] = [];
  for (const input of inputs) {
    const result = manifestSchema.safeParse(input.json);
    if (result.success) parsed.push({ manifest: result.data, input });
    else {
      for (const issue of result.error.issues) {
        const where = issue.path.length > 0 ? issue.path.join('.') : '(root)';
        problems.push({ file: input.file, message: `${where}: ${issue.message}` });
      }
    }
  }
  if (problems.length > 0) {
    if (parsed.length > 0) {
      problems.push({
        file: '(manifests)',
        message: 'cross-manifest checks skipped until every manifest parses',
      });
    }
    return problems;
  }
  return crossCheck(parsed);
}

function crossCheck(parsed: readonly Parsed[]): ManifestProblem[] {
  const problems: ManifestProblem[] = [];
  const byId = new Map<string, Parsed>();
  const owners = {
    module: new Map<string, string>(),
    entity: new Map<string, string>(),
    tool: new Map<string, string>(),
    prefix: new Map<string, string>(),
    error: new Map<string, string>(Object.keys(CORE_ERRORS).map((code) => [code, 'core'])),
  };
  const emitted = new Map<string, Set<number>>();
  for (const p of parsed) {
    byId.set(p.manifest.id, p);
    for (const event of p.manifest.events_emitted) {
      const versions = emitted.get(event.name) ?? new Set<number>();
      versions.add(event.version);
      emitted.set(event.name, versions);
    }
  }

  for (const { manifest, input } of parsed) {
    const add = (message: string): void => {
      problems.push({ file: input.file, message });
    };
    const own = new Set(manifest.entities);
    const entityOf = (dotted: string): string => dotted.split('.')[0] ?? '';

    claim(
      owners.module,
      manifest.id,
      manifest.id,
      `module id ${manifest.id} is declared by two manifests`,
      add,
      true,
    );
    if (input.register !== undefined) {
      if (manifest.id !== input.register.id)
        add(`id is ${manifest.id}, but the register entry is ${input.register.id}`);
      const registered = [...input.register.depends].sort().join(',');
      if ([...manifest.depends].sort().join(',') !== registered) {
        add(
          `depends [${manifest.depends.join(', ')}] differs from the register's [${input.register.depends.join(', ')}]`,
        );
      }
    }
    if (input.packageVersion !== undefined && manifest.version !== input.packageVersion) {
      add(`version ${manifest.version} differs from package.json version ${input.packageVersion}`);
    }
    if (input.requiredLayer !== undefined && manifest.layer !== input.requiredLayer) {
      add(`layer is ${manifest.layer}, but a module here must be ${input.requiredLayer}`);
    }
    for (const dep of manifest.depends) {
      const target = byId.get(dep);
      if (target === undefined) add(`depends on ${dep}, which has no manifest`);
      else if (target.manifest.layer > manifest.layer) {
        add(`depends on ${dep} in ${target.manifest.layer}, a higher layer than ${manifest.layer}`);
      }
    }

    for (const entity of manifest.entities)
      claim(owners.entity, entity, manifest.id, `declares entity ${entity}`, add);
    const mustOwn = (what: string, name: string): void => {
      if (!own.has(entityOf(name)))
        add(`${what} ${name}, but ${entityOf(name)} is not one of its entities`);
    };
    for (const event of manifest.events_emitted) {
      mustOwn('emits', event.name);
      if (input.fileExists !== undefined && !input.fileExists(event.schema)) {
        add(`event ${event.name} v${String(event.version)} schema ${event.schema} does not exist`);
      }
    }
    for (const permission of manifest.permissions) mustOwn('declares permission', permission);
    for (const hook of manifest.workflow_hooks) mustOwn('declares workflow hook', hook);
    for (const host of manifest.custom_field_hosts) {
      if (!own.has(host)) add(`custom_field_hosts names ${host}, which is not one of its entities`);
    }
    for (const event of manifest.events_consumed) {
      if (!(emitted.get(event.name)?.has(event.version) ?? false)) {
        add(`consumes ${event.name} v${String(event.version)}, which no manifest emits`);
      }
    }
    const ownPermissions = new Set(manifest.permissions);
    for (const tool of manifest.tools) {
      claim(owners.tool, tool.name, manifest.id, `declares tool ${tool.name}`, add);
      if (!ownPermissions.has(tool.permission)) {
        add(
          `tool ${tool.name} needs permission ${tool.permission}, which this module does not declare`,
        );
      }
    }
    for (const code of Object.keys(manifest.errors)) {
      claim(owners.error, code, manifest.id, `declares error code ${code}`, add);
    }
    if (manifest.table_prefix !== undefined) {
      claim(
        owners.prefix,
        manifest.table_prefix,
        manifest.id,
        `uses table prefix ${manifest.table_prefix}`,
        add,
      );
    } else if (manifest.entities.length > 0) {
      add('declares entities but no table_prefix');
    }
    if (
      manifest.config_schema !== undefined &&
      input.fileExists !== undefined &&
      !input.fileExists(manifest.config_schema)
    ) {
      add(`config_schema ${manifest.config_schema} does not exist`);
    }
  }
  return problems;
}

/** Records the first owner of a name; anyone else claiming it is a problem. */
function claim(
  owners: Map<string, string>,
  name: string,
  claimant: string,
  what: string,
  add: (message: string) => void,
  sameClaimantIsDuplicate = false,
): void {
  const owner = owners.get(name);
  if (owner === undefined) owners.set(name, claimant);
  else if (sameClaimantIsDuplicate) add(what);
  else if (owner !== claimant) add(`${what}, already owned by ${owner}`);
}
