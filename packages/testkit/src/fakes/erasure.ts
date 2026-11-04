import {
  coreError,
  err,
  ok,
  type AppError,
  type EraserHandler,
  type EraserRegistry,
  type HandlerOutcome,
  type IncompleteSubjectReport,
  type Result,
  type SubjectReport,
} from '@gx/core';

/** How long one handler may take before its outcome counts as a failure. */
const DEFAULT_HANDLER_TIMEOUT_MS = 30_000;

/** True only for a well-formed `{ ok: true, value }` or `{ ok: false, error }`. */
function isResult(value: unknown): value is Result<unknown, AppError> {
  if (typeof value !== 'object' || value === null || !Object.hasOwn(value, 'ok')) return false;
  const okValue = (value as { ok: unknown }).ok;
  return okValue === true
    ? Object.hasOwn(value, 'value')
    : okValue === false && Object.hasOwn(value, 'error');
}

/** In-memory registry; K7b's real one adds the request desk, clocks and evidence. */
export function inMemoryEraserRegistry(
  options: { readonly handlerTimeoutMs?: number } = {},
): EraserRegistry {
  const timeoutMs = options.handlerTimeoutMs ?? DEFAULT_HANDLER_TIMEOUT_MS;
  const handlers = new Map<string, EraserHandler>();

  async function runOne<T>(
    handler: EraserHandler,
    run: (handler: EraserHandler) => Promise<Result<T, AppError>>,
  ): Promise<HandlerOutcome<T>> {
    const name = `${handler.module}.${handler.entity}`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<Result<T, AppError>>((resolve) => {
      timer = setTimeout(() => {
        resolve(
          err(
            coreError('DEPENDENCY_UNAVAILABLE', {
              detail: `handler ${name} did not answer within ${String(timeoutMs)} ms`,
            }),
          ),
        );
      }, timeoutMs);
    });
    let result: Result<T, AppError>;
    try {
      const answer: unknown = await Promise.race([run(handler), deadline]);
      result = isResult(answer)
        ? (answer as Result<T, AppError>)
        : err(coreError('INTERNAL', { detail: `handler ${name} returned a malformed result` }));
    } catch (error) {
      result = err(coreError('INTERNAL', { detail: `handler ${name} threw`, cause: error }));
    } finally {
      clearTimeout(timer);
    }
    return { module: handler.module, entity: handler.entity, result };
  }

  async function runAll<T>(
    run: (handler: EraserHandler) => Promise<Result<T, AppError>>,
  ): Promise<Result<SubjectReport<T>, IncompleteSubjectReport<T>>> {
    if (handlers.size === 0) return err({ code: 'NO_HANDLERS', outcomes: [] });
    const outcomes = await Promise.all([...handlers.values()].map((h) => runOne(h, run)));
    return outcomes.every((o) => o.result.ok)
      ? ok({ outcomes })
      : err({ code: 'INCOMPLETE', outcomes });
  }

  return {
    register(handler) {
      const key = `${handler.module}.${handler.entity}`;
      if (handlers.has(key)) {
        return err(coreError('CONFLICT', { detail: `a handler for ${key} is already registered` }));
      }
      handlers.set(key, handler);
      return ok(undefined);
    },
    erase: (context, subject) => runAll((h) => h.erase(context, subject)),
    export: (context, subject) => runAll((h) => h.export(context, subject)),
  };
}
