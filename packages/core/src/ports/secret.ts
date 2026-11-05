const REDACTED = '[secret]';
const redacted = (): string => REDACTED;

/**
 * A credential that cannot leak by accident: `String()`, template literals, `JSON.stringify`
 * and Node's `util.inspect` all print `[secret]`. Only `reveal()` returns the value, so every
 * use is visible in review.
 */
export class Secret {
  readonly #value: string;

  constructor(value: string) {
    if (typeof value !== 'string' || value === '') {
      throw new TypeError('A secret needs a non-empty string value');
    }
    this.#value = value;
    Object.defineProperty(this, Symbol.for('nodejs.util.inspect.custom'), { value: redacted });
    Object.defineProperty(this, Symbol.toPrimitive, { value: redacted });
    Object.freeze(this);
  }

  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }
}
