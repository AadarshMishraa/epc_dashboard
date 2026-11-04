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
    events_emitted: ['invoice.issued', 'invoice.overdue'],
    events_consumed: ['tenant.created'],
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
    tests: ['tenant_isolation', 'permission', 'idempotency', 'pack_conformance'],
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
    events_emitted: ['tenant.created'],
    events_consumed: [],
    permissions: ['tenant.read'],
    custom_field_hosts: [],
    workflow_hooks: [],
    tools: [],
    extension_points: [],
    errors: {},
    tests: ['tenant_isolation'],
    ...overrides,
  };
}

function input(
  json: Record<string, unknown>,
  register?: { id: string; depends: string[] },
): ManifestInput {
  const id = String(json['id']);
  const depends = Array.isArray(json['depends']) ? (json['depends'] as string[]) : [];
  return {
    file: `packages/${id}/manifest.json`,
    json,
    register: register ?? { id, depends },
    packageVersion: '1.0.0',
  };
}

const messages = (...inputs: ManifestInput[]): string[] =>
  validateManifests(inputs).map((p) => p.message);

describe('validateManifests', () => {
  it('accepts the spec example', () => {
    expect(messages(input(billing()), input(tenancy()))).toEqual([]);
  });

  it('rejects an unknown key and names it (F-04-AC1)', () => {
    const [problem] = messages(input(billing({ owner: 'someone' })), input(tenancy()));
    expect(problem).toContain('owner');
  });

  it('rejects a consumed event that no manifest emits', () => {
    expect(
      messages(input(billing({ events_consumed: ['order.confirmed'] })), input(tenancy())),
    ).toEqual(['consumes order.confirmed, which no manifest emits']);
  });

  it('rejects an emitted event whose entity the module does not own', () => {
    expect(
      messages(input(billing({ events_emitted: ['payment.received'] })), input(tenancy())),
    ).toContain('emits payment.received, but payment is not one of its entities');
  });

  it('rejects a tool without a mode', () => {
    const tools = [{ name: 'receivables_due', permission: 'invoice.read' }];
    expect(messages(input(billing({ tools })), input(tenancy())).join()).toContain('tools.0.mode');
  });

  it('rejects a tool mode that would act directly (only read and draft exist)', () => {
    const tools = [{ name: 'send_invoice', mode: 'write', permission: 'invoice.issue' }];
    expect(messages(input(billing({ tools })), input(tenancy())).join()).toContain('tools.0.mode');
  });

  it('rejects a tool whose permission is not declared', () => {
    const tools = [{ name: 'receivables_due', mode: 'read', permission: 'invoice.export' }];
    expect(messages(input(billing({ tools })), input(tenancy()))).toEqual([
      'tool receivables_due needs permission invoice.export, which no manifest declares',
    ]);
  });

  it('rejects an error code that collides with core', () => {
    const errors = { NOT_FOUND: { status: 404, message: 'Gone.', retryable: false } };
    expect(messages(input(billing({ errors })), input(tenancy()))).toEqual([
      'declares error code NOT_FOUND, already owned by core',
    ]);
  });

  it('rejects an error code that collides with another module', () => {
    const errors = { INVOICE_LOCKED: { status: 422, message: 'Locked.', retryable: false } };
    expect(messages(input(billing()), input(tenancy({ errors })))).toEqual([
      'declares error code INVOICE_LOCKED, already owned by billing',
    ]);
  });

  it('rejects an error with a status outside the conventions', () => {
    const errors = { TEAPOT: { status: 418, message: 'No.', retryable: false } };
    expect(messages(input(billing({ errors })), input(tenancy())).join()).toContain(
      'errors.TEAPOT.status',
    );
  });

  it('rejects depends that differ from the register', () => {
    expect(
      messages(
        input(billing(), { id: 'billing', depends: ['k1-tenancy', 'k6-events'] }),
        input(tenancy()),
      ),
    ).toEqual(["depends [k1-tenancy] differs from the register's [k1-tenancy, k6-events]"]);
  });

  it('rejects a dependency on a higher layer', () => {
    expect(
      messages(input(tenancy({ depends: ['billing'] })), input(billing({ events_consumed: [] }))),
    ).toContain('depends on billing in L2, a higher layer than L0');
  });

  it('rejects an id or version that differs from the register and package.json', () => {
    const wrong = {
      ...input(tenancy()),
      register: { id: 'k2-identity', depends: [] },
      packageVersion: '1.1.0',
    };
    expect(validateManifests([wrong]).map((p) => p.message)).toEqual([
      'id is k1-tenancy, but the register entry is k2-identity',
      'version 1.0.0 differs from package.json version 1.1.0',
    ]);
  });

  it('rejects a custom field host that is not an entity', () => {
    expect(messages(input(billing({ custom_field_hosts: ['quote'] })), input(tenancy()))).toEqual([
      'custom_field_hosts names quote, which is not in entities',
    ]);
  });

  it('rejects two modules claiming the same table prefix, event or permission', () => {
    const clash = tenancy({ id: 'k2-identity', table_prefix: 'k1_' });
    const result = messages(input(tenancy()), input(clash));
    expect(result).toEqual([
      'emits tenant.created, already owned by k1-tenancy',
      'declares permission tenant.read, already owned by k1-tenancy',
      'uses table prefix k1_, already owned by k1-tenancy',
    ]);
  });

  it('rejects entities without a table prefix', () => {
    const json = tenancy();
    delete json['table_prefix'];
    expect(messages(input(json))).toEqual(['declares entities but no table_prefix']);
  });

  it.each([
    ['event name', { events_emitted: ['TenantCreated'] }, 'events_emitted.0'],
    ['permission name', { permissions: ['read-tenant'] }, 'permissions.0'],
    ['version', { version: 'v1' }, 'version'],
    ['layer', { layer: 'L9' }, 'layer'],
    ['test name', { tests: ['smoke'] }, 'tests.0'],
  ])('rejects a malformed %s', (_label, overrides, path) => {
    expect(messages(input(tenancy(overrides))).join()).toContain(path);
  });
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

  const register = {
    packages: [
      {
        id: 'k1-tenancy',
        package: '@gx/k1-tenancy',
        path: 'packages/k1-tenancy',
        kind: 'module',
        plan: 'K1',
        purpose: 'x',
        depends: [],
      },
      {
        id: 'testkit',
        package: '@gx/testkit',
        path: 'packages/testkit',
        kind: 'support',
        plan: 'K0',
        purpose: 'x',
        depends: [],
      },
    ],
  };

  it('requires a manifest for every module, not for support packages', () => {
    const root = workspace({
      'packages/register.json': register,
      'packages/k1-tenancy/package.json': { version: '1.0.0' },
    });
    expect(checkManifests({ root }).problems).toEqual([
      {
        file: 'packages/k1-tenancy/manifest.json',
        message: 'module k1-tenancy has no manifest.json',
      },
    ]);
  });

  it('reports invalid JSON with the file', () => {
    const root = workspace({
      'packages/register.json': register,
      'packages/k1-tenancy/package.json': { version: '1.0.0' },
      'packages/k1-tenancy/manifest.json': '{ nope',
    });
    expect(checkManifests({ root }).problems[0]?.message).toMatch(/^not valid JSON/);
  });

  it('exits 1 from the command line and names the unknown key', () => {
    const root = workspace({
      'packages/register.json': register,
      'packages/k1-tenancy/package.json': { version: '1.0.0' },
      'packages/k1-tenancy/manifest.json': { ...tenancy(), surprise: true },
    });
    const cli = fileURLToPath(new URL('./bin/check-manifests.ts', import.meta.url));
    const result = spawnSync(process.execPath, ['--conditions=@gx/source', cli, '--root', root], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('surprise');
  });

  it('passes on this repository', () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const result = checkManifests({ root });
    expect(result.problems).toEqual([]);
    expect(result.manifestsChecked).toBe(10);
  });
});
