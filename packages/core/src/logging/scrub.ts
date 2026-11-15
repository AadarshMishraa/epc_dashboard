/**
 * The pattern backstop for log text (threat model docs/security/threat-models/K0-T04-logging.md).
 * Classification is the first control; this catches personal data and credentials that reach
 * a log string anyway. It cannot see data with no shape (a name, an address), and it prefers
 * a false mask to a leak. Every rule is linear or bounded by the input cap.
 */

/** A longer string is not scanned; it is replaced by a marker. */
export const SCRUB_MAX_INPUT_LENGTH = 2_048;
/** Scrubbed text is cut to this length, marker included. */
export const SCRUB_MAX_OUTPUT_LENGTH = 1_024;
export const TOO_LONG_MARKER = '[omitted:too_long]';
const TRUNCATED_MARKER = '...[truncated]';

/** Mobiles (10), local landlines (8), national ids (12), cards (13 to 19), accounts (9 to 18). */
const MIN_MASKED_DIGITS = 8;

/** Zero-width and other invisible characters that split a number or address in two. */
const FORMAT_CHARACTERS = /\p{Cf}/gu;
const ENCODED_AT = /%40/g;
/** The user and password part of a `scheme://user:password@host` token. */
const URL_CREDENTIALS = /:\/\/[^/\s@]*@/gu;
/** The query string and fragment of a `scheme://` token; signed links and codes live there. */
const URL_QUERY = /(:\/\/[^\s?#]*)[?#]\S*/gu;
/** `password=...`, `"token": "..."`, `Authorization: Basic ...`: the value after a secret's name. */
const NAMED_SECRET =
  /((?:authorization|api[_-]?key|password|passwd|pwd|secret|token)["']?\s*[:=]\s*)(?:(?:basic|bearer|digest)\s+)?[^\s&,;]+/giu;
const BEARER_TOKEN = /\bbearer[\s:=]+[A-Za-z0-9._~+/=-]+/giu;
const JWT_SHAPE = /eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/gu;
/**
 * A run of the characters an address may hold (RFC 5322 atoms and quotes, without `/`, so a
 * path such as `node_modules/@scope/name` survives). It is an address when an `@` has a
 * character on both sides, and then the whole run is masked.
 */
const ADDRESS_RUN = /[\p{L}\p{Nd}._%+@'"!#$&*=?^`{|}~-]+/gu;
const HAS_ADDRESS = /[^@]@[^@]/u;
/**
 * Record ids and ISO-8601 dates are kept, so a line can still be tied to a record and a day.
 * Both must stand alone: one glued to more digits or letters is scanned like any other text.
 */
const PROTECTED =
  /(?<![\p{L}\p{Nd}])[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?![\p{L}\p{Nd}])|(?<![\p{L}\p{Nd}.-])(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-][01]\d:[0-5]\d)?)?(?![\p{L}\p{Nd}]|[.-]\p{Nd})/giu;
/**
 * The Indian tax id shape (the fourth letter is the holder type), also inside a longer token:
 * a sole proprietor's business tax number embeds the owner's personal one.
 */
const TAX_ID_SHAPE = /[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z]/giu;
/** Digits in any script, with up to three separators between two digits. */
const DIGIT_RUN = /\p{Nd}(?:[\s\p{Pd}./()_,+\u00b7]{0,3}\p{Nd})*/gu;
const DIGIT = /\p{Nd}/gu;

function maskAddresses(text: string): string {
  return text.replace(ADDRESS_RUN, (run) => (HAS_ADDRESS.test(run) ? '[email]' : run));
}

function maskNumbers(text: string): string {
  return text
    .replace(TAX_ID_SHAPE, '[id]')
    .replace(DIGIT_RUN, (run) =>
      (run.match(DIGIT)?.length ?? 0) >= MIN_MASKED_DIGITS ? '[number]' : run,
    );
}

/** Applies the number rules to everything outside a protected record id or date. */
function maskOutsideProtected(text: string): string {
  let result = '';
  let position = 0;
  for (const match of text.matchAll(PROTECTED)) {
    result += maskNumbers(text.slice(position, match.index)) + match[0];
    position = match.index + match[0].length;
  }
  return result + maskNumbers(text.slice(position));
}

/**
 * Masks what looks like personal data or a credential in free text: email addresses and UPI
 * ids as `[email]`, runs of 8 or more digits (phones, national ids, cards, accounts) as
 * `[number]`, the tax id shape as `[id]`, URL query strings and fragments as `[query]`, URL
 * user parts as `[credentials]`, and bearer tokens, JWT shapes and the value after a secret's
 * name (`password=`, `token:`, `Authorization:`) as `[secret]`. There is no way to turn a
 * rule off.
 */
export function scrubText(text: string): string {
  if (text.length > SCRUB_MAX_INPUT_LENGTH) return TOO_LONG_MARKER;
  // Compatibility forms first, so a full-width `@` or a circled digit is seen as what it shows.
  const prepared = text.replace(FORMAT_CHARACTERS, '').normalize('NFKC').replace(ENCODED_AT, '@');
  // A few characters expand when normalised; the scan stays bounded by the same cap.
  if (prepared.length > SCRUB_MAX_INPUT_LENGTH) return TOO_LONG_MARKER;
  const withoutCredentials = prepared
    .replace(URL_CREDENTIALS, '://[credentials]@')
    .replace(URL_QUERY, '$1[query]')
    .replace(NAMED_SECRET, '$1[secret]')
    .replace(BEARER_TOKEN, '[secret]')
    .replace(JWT_SHAPE, '[secret]');
  const scrubbed = maskOutsideProtected(maskAddresses(withoutCredentials));
  return scrubbed.length > SCRUB_MAX_OUTPUT_LENGTH
    ? scrubbed.slice(0, SCRUB_MAX_OUTPUT_LENGTH - TRUNCATED_MARKER.length) + TRUNCATED_MARKER
    : scrubbed;
}

/** True when the scrubber would write the text exactly as given. */
export function isUnchangedByScrub(text: string): boolean {
  return scrubText(text) === text;
}
