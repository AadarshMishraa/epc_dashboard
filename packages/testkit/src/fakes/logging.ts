import type { LogSink } from '@gx/core';

/** One parsed log line, as `createLogger` writes it. */
export type LogRecord = Readonly<Record<string, unknown>> & {
  readonly level: string;
  readonly event: string;
  readonly correlation_id: string;
};

/**
 * In-memory LogSink. Keeps each line exactly as written, so a test can assert both on the
 * raw text (nothing unredacted reached the sink) and on the parsed records. `failWith`
 * makes every write throw, to test that the logger reports instead of throwing.
 */
export class MemoryLogSink implements LogSink {
  readonly #lines: string[] = [];
  #failure: Error | undefined;

  write(line: string): void {
    if (this.#failure !== undefined) throw this.#failure;
    if (typeof line !== 'string' || line.includes('\n')) {
      throw new TypeError('A log line must be one string without a newline');
    }
    this.#lines.push(line);
  }

  /** The raw lines, oldest first. */
  get lines(): readonly string[] {
    return [...this.#lines];
  }

  /** Every line parsed; a line that is not a JSON object fails the test loudly. */
  records(): readonly LogRecord[] {
    return this.#lines.map((line, index) => {
      const parsed = JSON.parse(line) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new TypeError(`Log line ${String(index)} is not a JSON object`);
      }
      return parsed as LogRecord;
    });
  }

  /** The records for one event key. */
  ofEvent(event: string): readonly LogRecord[] {
    return this.records().filter((record) => record.event === event);
  }

  clear(): void {
    this.#lines.length = 0;
  }

  failWith(error: Error | undefined): void {
    this.#failure = error;
  }
}
