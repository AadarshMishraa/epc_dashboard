// The manifest naming rules (docs/architecture/module-manifest.md), shared by the ports so a
// name a port accepts is one a manifest can declare.
const DOTTED = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
const SNAKE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

/** `entity.action` or `entity.past_tense_verb`, for example `invoice.issued`. */
export function isDottedName(value: unknown): value is string {
  return typeof value === 'string' && DOTTED.test(value);
}

export function isSnakeName(value: unknown): value is string {
  return typeof value === 'string' && SNAKE.test(value);
}

export function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}
