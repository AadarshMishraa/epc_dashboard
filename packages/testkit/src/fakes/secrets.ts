import { coreError, err, ok, Secret, type SecretsProvider, type TenantId } from '@gx/core';

export interface SecretsSeed {
  readonly platform?: Readonly<Record<string, string>>;
  readonly tenant?: readonly {
    readonly tenantId: TenantId;
    readonly name: string;
    readonly value: string;
  }[];
}

/** Missing and other-tenant secrets give the same NOT_FOUND, so the answer reveals nothing. */
export function fakeSecretsProvider(seed: SecretsSeed = {}): SecretsProvider {
  const platform = new Map(Object.entries(seed.platform ?? {}));
  const tenant = new Map((seed.tenant ?? []).map((s) => [`${s.tenantId}|${s.name}`, s.value]));
  const notFound = () => err(coreError('NOT_FOUND'));
  return {
    platform(name) {
      const value = platform.get(name);
      return Promise.resolve(value === undefined ? notFound() : ok(Secret.of(value)));
    },
    forTenant(context, name) {
      const value = tenant.get(`${context.tenantId}|${name}`);
      return Promise.resolve(value === undefined ? notFound() : ok(Secret.of(value)));
    },
  };
}
