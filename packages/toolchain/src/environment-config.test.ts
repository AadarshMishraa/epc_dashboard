import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Guards for the ADR-0006 hosting rules that live in repository configuration.
// If one of these fails, the change needs an ADR, not a test edit.

const read = (path: string): string =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

/** Values of `key = value` lines inside one `[section]` of a TOML file (flat sections only). */
function tomlSection(text: string, section: string): Map<string, string> {
  const values = new Map<string, string>();
  let current = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header?.[1] !== undefined) {
      current = header[1];
      continue;
    }
    const pair = /^([a-z_]+)\s*=\s*(.+)$/.exec(line);
    if (current === section && pair?.[1] !== undefined && pair[2] !== undefined) {
      values.set(pair[1], pair[2].replace(/^"|"$/g, ''));
    }
  }
  return values;
}

describe('supabase/config.toml', () => {
  const config = read('supabase/config.toml');

  it('pins Postgres 17, the version recorded in the K0 brief', () => {
    expect(tomlSection(config, 'db').get('major_version')).toBe('17');
  });

  it.each(['api', 'realtime', 'edge_runtime', 'auth'])(
    'keeps the %s surface off (no browser path to tenant data)',
    (section) => {
      expect(tomlSection(config, section).get('enabled')).toBe('false');
    },
  );

  it('runs the pooler in transaction mode, as production does', () => {
    const pooler = tomlSection(config, 'db.pooler');
    expect(pooler.get('enabled')).toBe('true');
    expect(pooler.get('pool_mode')).toBe('transaction');
  });

  it('leaves migrations to the package runner, not the Supabase CLI', () => {
    expect(tomlSection(config, 'db.migrations').get('enabled')).toBe('false');
  });
});

describe('.env.example', () => {
  const variables = read('.env.example')
    .split('\n')
    .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line));

  it('declares the variables the runbook documents', () => {
    const names = variables.map((line) => line.split('=')[0]);
    expect(names).toEqual([
      'GX_ENV',
      'DATABASE_URL',
      'DATABASE_MIGRATION_URL',
      'STORAGE_S3_ENDPOINT',
      'STORAGE_S3_REGION',
      'STORAGE_S3_ACCESS_KEY_ID',
      'STORAGE_S3_SECRET_ACCESS_KEY',
      'STORAGE_BUCKET',
      'SMTP_URL',
    ]);
  });

  it('exposes nothing to the browser and holds no Supabase API key', () => {
    for (const line of variables) {
      expect(line).not.toMatch(/^(NEXT_PUBLIC_|VITE_|PUBLIC_)/);
      expect(line).not.toMatch(/SERVICE_ROLE|ANON_KEY/i);
    }
  });

  it('holds placeholders or local-only values, never a hosted secret', () => {
    for (const line of variables) {
      expect(line).not.toMatch(/supabase\.(co|com)/);
    }
  });
});

describe('vercel.json', () => {
  const config = JSON.parse(read('vercel.json')) as {
    regions: string[];
    headers: { headers: { key: string; value: string }[] }[];
  };

  it('pins functions to Mumbai', () => {
    expect(config.regions).toEqual(['bom1']);
  });

  it('sends the baseline security headers on every route', () => {
    const keys = config.headers.flatMap((rule) => rule.headers.map((header) => header.key));
    expect(keys).toEqual(
      expect.arrayContaining([
        'Strict-Transport-Security',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'X-Frame-Options',
      ]),
    );
  });
});
