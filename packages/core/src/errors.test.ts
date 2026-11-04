import { describe, expect, it } from 'vitest';
import {
  CORE_ERRORS,
  appError,
  coreError,
  defineErrorCatalogue,
  toErrorResponse,
} from './errors.ts';

describe('the core error catalogue', () => {
  it('maps each code to the status in the API conventions', () => {
    const statuses = Object.fromEntries(Object.entries(CORE_ERRORS).map(([c, d]) => [c, d.status]));
    expect(statuses).toEqual({
      VALIDATION_FAILED: 400,
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      TENANT_REQUIRED: 403,
      ENTITLEMENT_REQUIRED: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      UNPROCESSABLE: 422,
      IDEMPOTENCY_KEY_REUSED: 422,
      RATE_LIMITED: 429,
      INTERNAL: 500,
      DEPENDENCY_UNAVAILABLE: 503,
    });
  });

  it('marks only rate limits and dependency outages as retryable', () => {
    const retryable = Object.entries(CORE_ERRORS)
      .filter(([, d]) => d.retryable)
      .map(([c]) => c);
    expect(retryable.sort()).toEqual(['DEPENDENCY_UNAVAILABLE', 'RATE_LIMITED']);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(CORE_ERRORS)).toBe(true);
  });

  it('never words a message in a way that reveals whether something exists elsewhere', () => {
    for (const { message } of Object.values(CORE_ERRORS)) {
      expect(message).not.toMatch(/tenant|account|exists|user id|stack|sql/i);
    }
  });
});

describe('defineErrorCatalogue', () => {
  const valid = { status: 404, message: 'Not here.', retryable: false } as const;

  it.each(['lowercase', 'Mixed_Case', 'TRAILING_', '_LEADING', 'DOUBLE__UNDERSCORE', ''])(
    'rejects the code %j',
    (code) => {
      expect(() => defineErrorCatalogue({ [code]: valid })).toThrow(TypeError);
    },
  );

  it('rejects a status outside the conventions', () => {
    expect(() => defineErrorCatalogue({ TEAPOT: { ...valid, status: 418 as 404 } })).toThrow('418');
  });

  it('rejects an empty public message', () => {
    expect(() => defineErrorCatalogue({ BLANK: { ...valid, message: '  ' } })).toThrow(
      'public message',
    );
  });

  it('builds module errors from a module catalogue', () => {
    const catalogue = defineErrorCatalogue({
      STAGE_LOCKED: { status: 422, message: 'This stage is locked.', retryable: false },
    });
    expect(appError(catalogue, 'STAGE_LOCKED')).toEqual({
      code: 'STAGE_LOCKED',
      status: 422,
      message: 'This stage is locked.',
      retryable: false,
      fields: [],
    });
  });
});

describe('toErrorResponse', () => {
  it('returns only the code, public message, fields and correlation id', () => {
    const error = coreError('VALIDATION_FAILED', {
      fields: [{ path: 'amount', code: 'TOO_SMALL' }],
      detail: 'amount -5 below minimum for tenant 0190f3e2',
      cause: new Error('stack with internals'),
    });
    expect(toErrorResponse(error, 'req-1')).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Some details are missing or not valid.',
        fields: [{ path: 'amount', code: 'TOO_SMALL' }],
        correlation_id: 'req-1',
      },
    });
  });

  it('does not carry extra properties smuggled onto field errors', () => {
    const smuggled = { path: 'phone', code: 'BAD', value: '+91 98765 43210' };
    const body = toErrorResponse(coreError('VALIDATION_FAILED', { fields: [smuggled] }), 'r');
    expect(JSON.stringify(body)).not.toContain('98765');
  });
});
