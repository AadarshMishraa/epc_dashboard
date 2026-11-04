import {
  coreError,
  err,
  ok,
  type AppError,
  type EraserHandler,
  type EraserRegistry,
  type HandlerOutcome,
  type Result,
  type SubjectReport,
} from '@gx/core';

/** In-memory registry; K7b's real one adds the request desk, clocks and evidence. */
export function inMemoryEraserRegistry(): EraserRegistry {
  const handlers = new Map<string, EraserHandler>();

  async function runAll<T>(
    run: (handler: EraserHandler) => Promise<Result<T, AppError>>,
  ): Promise<Result<SubjectReport<T>, AppError<'UNPROCESSABLE'>>> {
    if (handlers.size === 0) {
      return err(
        coreError('UNPROCESSABLE', { detail: 'no erasure or export handlers are registered' }),
      );
    }
    const outcomes: HandlerOutcome<T>[] = [];
    for (const handler of handlers.values()) {
      let result: Result<T, AppError>;
      try {
        result = await run(handler);
      } catch (error) {
        result = err(
          coreError('INTERNAL', {
            detail: `handler ${handler.module}.${handler.entity} threw`,
            cause: error,
          }),
        );
      }
      outcomes.push({ module: handler.module, entity: handler.entity, result });
    }
    return ok({ complete: outcomes.every((o) => o.result.ok), outcomes });
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
