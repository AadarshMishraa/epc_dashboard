/**
 * The error catalogue: every error a caller can see has a stable code, an HTTP status and
 * a plain public message. Messages never name tenants, accounts or internals; the
 * internal `detail` and `cause` go to logs only (development guidelines 8).
 */

/** HTTP statuses an error may map to (development guidelines 8). */
export const ERROR_STATUSES = [400, 401, 403, 404, 409, 422, 429, 500, 503] as const;
export type ErrorStatus = (typeof ERROR_STATUSES)[number];

export interface ErrorDefinition {
  readonly status: ErrorStatus;
  /** Shown to the caller. Plain words, no internals. */
  readonly message: string;
  /** True when the same request may succeed later without change. */
  readonly retryable: boolean;
}

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const STATUS_SET: ReadonlySet<number> = new Set(ERROR_STATUSES);

/**
 * Validates and freezes a set of error definitions. Core uses it for its own catalogue;
 * modules use it for theirs, and their manifests declare the codes (K0-T07).
 */
export function defineErrorCatalogue<const C extends Record<string, ErrorDefinition>>(
  catalogue: C,
): Readonly<C> {
  for (const [code, definition] of Object.entries(catalogue)) {
    if (!ERROR_CODE_PATTERN.test(code)) {
      throw new TypeError(`Invalid error code ${JSON.stringify(code)}: use UPPER_SNAKE_CASE`);
    }
    if (!STATUS_SET.has(definition.status)) {
      throw new TypeError(`Error ${code} has unsupported status ${String(definition.status)}`);
    }
    if (definition.message.trim() === '') {
      throw new TypeError(`Error ${code} needs a public message`);
    }
  }
  return Object.freeze({ ...catalogue });
}

export const CORE_ERRORS = defineErrorCatalogue({
  VALIDATION_FAILED: {
    status: 400,
    message: 'Some details are missing or not valid.',
    retryable: false,
  },
  UNAUTHENTICATED: { status: 401, message: 'Sign in to continue.', retryable: false },
  FORBIDDEN: { status: 403, message: 'You do not have permission to do this.', retryable: false },
  TENANT_REQUIRED: {
    status: 403,
    message: 'You do not have access to this workspace.',
    retryable: false,
  },
  ENTITLEMENT_REQUIRED: {
    status: 403,
    message: 'Your plan does not include this.',
    retryable: false,
  },
  NOT_FOUND: { status: 404, message: 'This item was not found.', retryable: false },
  CONFLICT: {
    status: 409,
    message: 'Someone else changed this. Reload to see the latest version, then try again.',
    retryable: false,
  },
  UNPROCESSABLE: {
    status: 422,
    message: 'This cannot be done in the current state.',
    retryable: false,
  },
  IDEMPOTENCY_KEY_REUSED: {
    status: 422,
    message: 'This request key was already used for a different request.',
    retryable: false,
  },
  RATE_LIMITED: { status: 429, message: 'Too many requests. Try again shortly.', retryable: true },
  INTERNAL: {
    status: 500,
    message: 'Something went wrong on our side. Quote the reference if you contact support.',
    retryable: false,
  },
  DEPENDENCY_UNAVAILABLE: {
    status: 503,
    message: 'A service we depend on is not responding. Try again shortly.',
    retryable: true,
  },
});

export type CoreErrorCode = keyof typeof CORE_ERRORS;

/** A field-level validation problem; `path` addresses the input, never stored data. */
export interface FieldError {
  readonly path: string;
  readonly code: string;
}

export interface AppError<C extends string = string> {
  readonly code: C;
  readonly status: ErrorStatus;
  readonly message: string;
  readonly retryable: boolean;
  readonly fields: readonly FieldError[];
  /** For logs only: what went wrong, without personal data. Never returned to a caller. */
  readonly detail?: string;
  /** For logs only. Never returned to a caller. */
  readonly cause?: unknown;
}

export interface AppErrorOptions {
  readonly fields?: readonly FieldError[];
  readonly detail?: string;
  readonly cause?: unknown;
}

/** Builds an error value from a catalogue entry. */
export function appError<const C extends string>(
  catalogue: Readonly<Record<C, ErrorDefinition>>,
  code: C,
  options: AppErrorOptions = {},
): AppError<C> {
  const definition = catalogue[code];
  return {
    code,
    status: definition.status,
    message: definition.message,
    retryable: definition.retryable,
    fields: options.fields ?? [],
    ...(options.detail === undefined ? {} : { detail: options.detail }),
    ...(options.cause === undefined ? {} : { cause: options.cause }),
  };
}

/** Shortcut for core codes. */
export function coreError<const C extends CoreErrorCode>(
  code: C,
  options: AppErrorOptions = {},
): AppError<C> {
  return appError<C>(CORE_ERRORS, code, options);
}

export interface ErrorResponseBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly fields: readonly FieldError[];
    readonly correlation_id: string;
  };
}

/**
 * The response body for an error (development guidelines 8). Only the code, the public
 * message, field problems and the correlation id leave the server.
 */
export function toErrorResponse(error: AppError, correlationId: string): ErrorResponseBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      fields: error.fields.map(({ path, code }) => ({ path, code })),
      correlation_id: correlationId,
    },
  };
}
