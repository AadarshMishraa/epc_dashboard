const REDACTED = '[secret]';
/** Node's inspect hook; a registered symbol, so it works without importing node:util. */
const inspectCustom: unique symbol = Symbol.for('nodejs.util.inspect.custom');

/**
 * A secret value (password pepper, API key, signing key). It prints as `[secret]`
 * everywhere: String(), template literals, JSON.stringify and console or util.inspect.
 * The value comes out only through an explicit `reveal()`, which is easy to grep for.
 */
export class Secret {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static of(value: string): Secret {
    if (value === '') throw new TypeError('A secret cannot be empty');
    return new Secret(value);
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

  [inspectCustom](): string {
    return REDACTED;
  }
}
