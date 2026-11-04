import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { checkManifests } from './manifest-check.ts';
import { validateManifests, type ManifestInput } from './manifest.ts';

/** The example from docs/architecture/module-manifest.md, as JSON. */
function billing(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'billing',
    layer: 'L2',
    version: '1.0.0',
    depends: ['k1-tenancy'],
    table_prefix: 'billing_',
    entities: ['invoice', 'invoice_line', 'credit_note', 'receipt'],
    events_emitted: [
      { name: 'invoice.issued', version: 1, schema: 'events/invoice.issued.v1.json' },
      { name: 'invoice.overdue', version: 1, schema: 'events/invoice.overdue.v1.json' },
    ],
    events_consumed: [{ name: 'tenant.created', version: 1 }],
    permissions: ['invoice.read', 'invoice.issue', 'invoice.void_request'],
    custom_field_hosts: ['invoice', 'invoice_line'],
    workflow_hooks: ['invoice.issue', 'invoice.send'],
    tools: [
      { name: 'receivables_due', mode: 'read', permission: 'invoice.read' },
      { name: 'draft_invoice', mode: 'draft', permission: 'invoice.issue' },
    ],
    extension_points: ['validateInvoice'],
    config_schema: 'billing.config.json',
    errors: {
      INVOICE_LOCKED: {
        status: 422,
        message: 'This invoice is issued and cannot change.',
        retryable: false,
      },
    },
    tests_planned: ['tenant_isolation', 'permission', 'idempotency', 'pack_conformance'],
    ...overrides,
  };
}

function tenancy(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'k1-tenancy',
    layer: 'L0',
    version: '1.0.0',
    depends: [],
    table_prefix: 'k1_',
    entities: ['tenant'],
    events_emitted: [
      { name: 'tenant.created', version: 1, schema: 'events/tenant.created.v1.json' },
    ],
    events_consumed: [],
    permissions: ['tenant.read'],
    custom_field_hosts: [],
    workflow_hooks: [],
    tools: [],
    extension_points: [],
    errors: {},
    tests_planned: ['tenant_isolation'],
    ...overrides,
  };
}

const always = (): boolean => true;

function input(json: Record<string, unknown>, extra: Partial<ManifestInput> = {}): ManifestInput {
  return { file: `${String(json['id'])}/manifest.json`, json, fileExists: always, ...extra };
}

const messages = (...inputs: ManifestInput[]): string[] =>
  validateManifests(inputs).map((p) => p.message);

describe('validateManifests: shape', () => {
  it('accepts the spec example', () => {
    expect(messages(input(billing()), input(tenancy()))).toEqual([]);
  });

  it('rejects an unknown key and names it once (F-04-AC1)', () => {
    const [problem] = messages(input(tenancy({ owner: 'someone' })));
    expect(problem).toContain('owner');
    expect(problem?.match(/owner/g)).toHaveLength(1);
  });

  it.each([
    [
      'event without a version',
      { events_emitted: [{ name: 'tenant.created', schema: 's.json' }] },
      'events_emitted.0.version',
    ],
    [
      'event without a schema',
      { events_emitted: [{ name: 'tenant.created', version: 1 }] },
      'events_emitted.0.schema',
    ],
    [
      'event name',
      { events_emitted: [{ name: 'TenantCreated', version: 1, schema: 's' }] },
      'events_emitted.0.name',
    ],
    ['permission name', { permissions: ['read-tenant'] }, 'permissions.0'],
    [
      'tool without a mode',
      { tools: [{ name: 'tenants_due', permission: 'tenant.read' }] },
      'tools.0.mode',
    ],
    [
      'tool that acts directly',
      { tools: [{ name: 'send_x', mode: 'write', permission: 'tenant.read' }] },
      'tools.0.mode',
    ],
    [
      'error status',
      { errors: { TEAPOT: { status: 418, message: 'No.', retryable: false } } },
      'errors.TEAPOT.status',
    ],
    ['version', { version: 'v1' }, 'version'],
    ['layer', { layer: 'L9' }, 'layer'],
    ['planned test', { tests_planned: ['smoke'] }, 'tests_planned.0'],
    ['duplicate entity', { entities: ['tenant', 'tenant'] }, 'entities'],
    [
      'duplicate event',
      {
        events_emitted: [
          { name: 'tenant.created', version: 1, schema: 's' },
          { name: 'tenant.created', version: 1, schema: 's' },
        ],
      },
      'events_emitted',
    ],
  ])('rejects a malformed %s', (_label, overrides, path) => {
    expect(messages(input(tenancy(overrides))).join()).toContain(path);
  });

  it('skips cross-checks while any manifest fails to parse, so errors do not cascade', () => {
    const result = messages(input(billing()), input(tenancy({ layer: 'L9' })));
    expect(result).toContain('cross-manifest checks skipped until every manifest parses');
    expect(result.join()).not.toContain('no manifest emits');
  });
});

describe('validateManifests: entity ownership', () => {
  it('rejects two modules declaring the same entity', () => {
    const other = tenancy({
      id: 'k2-identity',
      table_prefix: 'k2_',
      events_emitted: [],
      permissions: [],
    });
    expect(messages(input(tenancy()), input(other))).toEqual([
      'declares entity tenant, already owned by k1-tenancy',
    ]);
  });

  it.each([
    [
      'an event',
      { events_emitted: [{ name: 'payment.received', version: 1, schema: 's' }] },
      'emits payment.received',
    ],
    ['a permission', { permissions: ['payment.read'] }, 'declares permission payment.read'],
    [
      'a workflow hook',
      { workflow_hooks: ['nothing.here'] },
      'declares workflow hook nothing.here',
    ],
  ])('rejects %s on an entity the module does not own', (_label, overrides, text) => {
    expect(messages(input(tenancy(overrides))).join()).toContain(`${text}, but`);
  });

  it('rejects a custom field host that is not an entity', () => {
    expect(messages(input(tenancy({ custom_field_hosts: ['quote'] })))).toEqual([
      'custom_field_hosts names quote, which is not one of its entities',
    ]);
  });

  it("rejects a tool using another module's permission", () => {
    const tools = [{ name: 'tenants_due', mode: 'read', permission: 'tenant.read' }];
    expect(messages(input(billing({ tools })), input(tenancy()))).toEqual([
      'tool tenants_due needs permission tenant.read, which this module does not declare',
    ]);
  });

  it('rejects a tool name used by two modules', () => {
    const tools = [{ name: 'receivables_due', mode: 'read', permission: 'tenant.read' }];
    expect(messages(input(billing()), input(tenancy({ tools })))).toEqual([
      'declares tool receivables_due, already owned by billing',
    ]);
  });

  it('rejects two manifests with the same module id', () => {
    expect(
      messages(
        input(tenancy()),
        input(
          tenancy({
            entities: ['other'],
            events_emitted: [],
            permissions: [],
            table_prefix: 'kx_',
          }),
        ),
      ),
    ).toContain('module id k1-tenancy is declared by two manifests');
  });
});

describe('validateManifests: events, errors and files', () => {
  it('rejects a consumed event or version that nobody emits', () => {
    expect(
      messages(
        input(billing({ events_consumed: [{ name: 'tenant.created', version: 2 }] })),
        input(tenancy()),
      ),
    ).toEqual(['consumes tenant.created v2, which no manifest emits']);
  });

  it('rejects an error code that collides with core', () => {
    const errors = { NOT_FOUND: { status: 404, message: 'Gone.', retryable: false } };
    expect(messages(input(tenancy({ errors })))).toEqual([
      'declares error code NOT_FOUND, already owned by core',
    ]);
  });

  it('rejects an error code that collides with another module', () => {
    const errors = { INVOICE_LOCKED: { status: 422, message: 'Locked.', retryable: false } };
    expect(messages(input(billing()), input(tenancy({ errors })))).toEqual([
      'declares error code INVOICE_LOCKED, already owned by billing',
    ]);
  });

  it('rejects a missing config schema or event schema file', () => {
    const missing = (path: string): boolean =>
      path !== 'billing.config.json' && !path.includes('overdue');
    expect(messages(input(billing(), { fileExists: missing }), input(tenancy()))).toEqual([
      'event invoice.overdue v1 schema events/invoice.overdue.v1.json does not exist',
      'config_schema billing.config.json does not exist',
    ]);
  });

  it('rejects entities without a table prefix, and a shared prefix', () => {
    const json = tenancy();
    delete json['table_prefix'];
    expect(messages(input(json))).toEqual(['declares entities but no table_prefix']);
    const clash = billing({ table_prefix: 'k1_' });
    expect(messages(input(clash), input(tenancy()))).toEqual([
      'uses table prefix k1_, already owned by billing',
    ]);
  });
});

describe('validateManifests: register, layers and dependencies', () => {
  const foundation = (json: Record<string, unknown>, depends: string[] = []): ManifestInput =>
    input(json, {
      register: { id: String(json['id']), depends },
      packageVersion: '1.0.0',
      allowedLayers: ['L0'],
    });

  it('rejects depends that differ from the register', () => {
    expect(messages(foundation(tenancy(), ['core']))).toContain(
      "depends [] differs from the register's [core]",
    );
  });

  it('rejects an id or version that differs from the register and package.json', () => {
    const wrong = {
      ...foundation(tenancy()),
      register: { id: 'k2-identity', depends: [] },
      packageVersion: '1.1.0',
    };
    expect(validateManifests([wrong]).map((p) => p.message)).toEqual([
      'id is k1-tenancy, but the register entry is k2-identity',
      'version 1.0.0 differs from package.json version 1.1.0',
    ]);
  });

  it('rejects a foundation module that is not L0', () => {
    expect(messages(foundation(tenancy({ layer: 'L2' })))).toEqual([
      'layer is L2, but a module here must be L0',
    ]);
  });

  it('rejects a dependency on a higher layer and on a module without a manifest', () => {
    const result = messages(
      input(tenancy({ depends: ['billing', 'ghost'] })),
      input(billing({ events_consumed: [] })),
    );
    expect(result).toContain('depends on billing in L2, a higher layer than L0');
    expect(result).toContain('depends on ghost, which has no manifest');
  });
});

describe('validateManifests: re-review findings', () => {
  it('rejects one module declaring the same tool name twice, even with different modes', () => {
    const tools = [
      { name: 'tenants_due', mode: 'read', permission: 'tenant.read' },
      { name: 'tenants_due', mode: 'draft', permission: 'tenant.read' },
    ];
    expect(messages(input(tenancy({ tools }))).join()).toContain(
      'lists the same tool name more than once',
    );
  });

  it('rejects one event version declared twice with different schemas', () => {
    const events_emitted = [
      { name: 'tenant.created', version: 1, schema: 'a.json' },
      { name: 'tenant.created', version: 1, schema: 'b.json' },
    ];
    expect(messages(input(tenancy({ events_emitted }))).join()).toContain(
      'lists the same event version more than once',
    );
  });

  it('allows two versions of one event side by side', () => {
    const events_emitted = [
      { name: 'tenant.created', version: 1, schema: 'v1.json' },
      { name: 'tenant.created', version: 2, schema: 'v2.json' },
    ];
    expect(messages(input(tenancy({ events_emitted })))).toEqual([]);
  });

  it.each(['../secrets.json', '/etc/passwd', 'events/../../x.json', 'C:/x.json'])(
    'rejects the schema path %s, which leaves the package',
    (schema) => {
      expect(messages(input(tenancy({ config_schema: schema }))).join()).toContain(
        'inside the package',
      );
    },
  );
});

describe('checkManifests on a workspace', () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function workspace(files: Record<string, unknown>): string {
    const root = mkdtempSync(join(tmpdir(), 'gx-manifests-'));
    roots.push(root);
    for (const [path, contents] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(
        join(root, path),
        typeof contents === 'string' ? contents : JSON.stringify(contents),
      );
    }
    return root;
  }

  const entry = (id: string, kind: string, plan = 'K1') => ({
    id,
    package: `@gx/${id}`,
    path: `packages/${id}`,
    kind,
    plan,
    purpose: 'x',
    depends: [],
  });
  const register = { packages: [entry('k1-tenancy', 'module'), entry('testkit', 'support', 'K0')] };
  const base = {
    'packages/register.json': register,
    'packages/k1-tenancy/package.json': { version: '1.0.0' },
    'packages/k1-tenancy/events/tenant.created.v1.json': {},
  };

  it('requires a manifest for every module, not for support packages', () => {
    const root = workspace(base);
    expect(checkManifests({ root }).problems).toEqual([
      {
        file: 'packages/k1-tenancy/manifest.json',
        message: 'module k1-tenancy has no manifest.json',
      },
    ]);
  });

  it('rejects a manifest on a support package or an unregistered foundation package', () => {
    const root = workspace({
      ...base,
      'packages/k1-tenancy/manifest.json': tenancy(),
      'packages/testkit/manifest.json': tenancy({ id: 'testkit' }),
      'packages/stray/manifest.json': tenancy({ id: 'stray' }),
    });
    expect(checkManifests({ root }).problems.map((p) => p.message)).toEqual([
      'packages/stray has a manifest but no entry in packages/register.json',
      'testkit is a support package; only modules have manifests',
    ]);
  });

  it('validates a pack module declared by manifest only, with no foundation file changed (F-06-AC3)', () => {
    const root = workspace({
      ...base,
      'packages/k1-tenancy/manifest.json': tenancy(),
      'packs/demo/modules/visits/manifest.json': {
        ...tenancy({
          id: 'visits',
          layer: 'L3',
          table_prefix: 'visits_',
          entities: ['visit'],
          permissions: ['visit.read'],
        }),
        depends: ['k1-tenancy'],
        events_emitted: [],
        events_consumed: [{ name: 'tenant.created', version: 1 }],
      },
    });
    const result = checkManifests({ root });
    expect(result.problems).toEqual([]);
    expect(result.manifestsChecked).toBe(2);
  });

  it('requires a pack module to be L3 or L4', () => {
    const root = workspace({
      ...base,
      'packages/k1-tenancy/manifest.json': tenancy(),
      'packs/demo/modules/visits/manifest.json': tenancy({
        id: 'visits',
        layer: 'L0',
        table_prefix: 'visits_',
        entities: ['visit'],
        permissions: [],
        events_emitted: [],
      }),
    });
    expect(checkManifests({ root }).problems.map((p) => p.message)).toEqual([
      'layer is L0, but a module here must be L3 or L4',
    ]);
  });

  it('ignores manifest.json files outside module locations (web app manifests, fixtures)', () => {
    const root = workspace({
      ...base,
      'packages/k1-tenancy/manifest.json': tenancy(),
      'packages/k1-tenancy/public/manifest.json': { name: 'a web app' },
      'packs/demo/fixtures/manifest.json': { nope: true },
    });
    expect(checkManifests({ root }).problems).toEqual([]);
  });

  it('checks a pack manifest too, so it cannot be silently skipped', () => {
    const root = workspace({
      ...base,
      'packages/k1-tenancy/manifest.json': tenancy(),
      'packs/demo/modules/visits/manifest.json': { id: 'visits', surprise: true },
    });
    expect(checkManifests({ root }).problems.map((p) => p.file)).toContain(
      'packs/demo/modules/visits/manifest.json',
    );
  });

  it('reports invalid JSON with the file', () => {
    const root = workspace({ ...base, 'packages/k1-tenancy/manifest.json': '{ nope' });
    expect(checkManifests({ root }).problems[0]?.message).toMatch(/^not valid JSON/);
  });

  it('exits 1 from the command line and prints file: message', () => {
    const root = workspace({
      ...base,
      'packages/k1-tenancy/manifest.json': { ...tenancy(), surprise: true },
    });
    const cli = fileURLToPath(new URL('./bin/check-manifests.ts', import.meta.url));
    const result = spawnSync(process.execPath, ['--conditions=@gx/source', cli, '--root', root], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('packages/k1-tenancy/manifest.json: (root): Unrecognized key');
    expect(result.stderr).toContain('surprise');
  });

  it('passes on this repository', () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const result = checkManifests({ root });
    expect(result.problems).toEqual([]);
    expect(result.manifestsChecked).toBe(10);
  });
});
