import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as core from './index.ts';

interface PackageJson {
  readonly name: string;
}
interface Register {
  readonly packages: readonly { readonly id: string; readonly package: string }[];
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
}

describe('@gx/core public API', () => {
  it('exposes the id this package has in packages/register.json', () => {
    const { name } = readJson('../package.json') as PackageJson;
    const { packages } = readJson('../../register.json') as Register;
    const entry = packages.find((p) => p.package === name);
    expect(entry).toBeDefined();
    expect(core.MODULE_ID).toBe(entry?.id);
  });

  it('exports exactly the documented runtime names', () => {
    // A change here is a public-API change: update the README and the changelog with it.
    expect(Object.keys(core).sort()).toEqual([
      'ALLOW',
      'AUDIT_OUTCOMES',
      'AUTHORIZATION_DENIALS',
      'CLASSIFICATIONS',
      'CORE_ERRORS',
      'ENTITLEMENT_DENIALS',
      'ERROR_STATUSES',
      'LOG_LEVELS',
      'MESSAGE_CHANNELS',
      'MODULE_ID',
      'MODULE_ID_MAX_LENGTH',
      'QUOTA_DENIALS',
      'REDACTION_LIMITS',
      'Secret',
      'actorModeDenial',
      'appError',
      'authorize',
      'checkEntitlement',
      'classifyField',
      'consumeQuota',
      'coreError',
      'correlationIdFromId',
      'createAuditRecord',
      'createContext',
      'createEventEnvelope',
      'createIdGenerator',
      'createLogger',
      'defineErrorCatalogue',
      'deny',
      'deriveContext',
      'err',
      'idTimestamp',
      'isAllowed',
      'isClassification',
      'isEraserHandlerId',
      'isErasureComplete',
      'isId',
      'isIdempotencyKey',
      'isModuleId',
      'isPersonalKey',
      'isQuotaAmount',
      'isSecretKey',
      'maskRecipient',
      'moduleId',
      'nowDate',
      'ok',
      'parseAiClientId',
      'parseCorrelationId',
      'parseId',
      'parseTenantId',
      'prepareAuditEntry',
      'prepareEvent',
      'prepareMessage',
      'redactString',
      'redactValue',
      'requireTenant',
      'runEraser',
      'summariseError',
      'systemClock',
      'toErrorResponse',
      'toFrozenJson',
      'webCryptoRandomBytes',
    ]);
  });
});
