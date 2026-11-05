import type { CorrelationId, TenantContext, TenantId } from '../context.ts';
import { coreError, type AppError, type FieldError } from '../errors.ts';
import type { Id } from '../ids.ts';
import { err, ok, type Result } from '../result.ts';
import { isNonBlankString, isSnakeName } from './names.ts';

export const MESSAGE_CHANNELS = Object.freeze(['email', 'sms', 'whatsapp'] as const);
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export interface OutboundMessage {
  readonly channel: MessageChannel;
  /** An email address, or an E.164 phone number (`+919800001234`) for SMS and WhatsApp. */
  readonly to: string;
  /** A registered template name, snake_case; free text is never sent. */
  readonly template: string;
  /** Why this person is contacted, from the notice (for example `billing`). */
  readonly purpose: string;
  /**
   * The consent record that allows this message, or the documented legal-basis reference
   * for a message that needs no consent (for example a sign-in code). Always required.
   */
  readonly consentRef: string;
  readonly params?: Readonly<Record<string, string>>;
}

declare const preparedMessageBrand: unique symbol;

/** A message that passed `prepareMessage`; only that function produces one. */
export type PreparedMessage = OutboundMessage & { readonly [preparedMessageBrand]: true };

export interface SentMessage {
  readonly id: Id;
  readonly tenantId: TenantId;
  readonly correlationId: CorrelationId;
  readonly channel: MessageChannel;
  /** Masked with `maskRecipient`; the full address is never kept with the send record. */
  readonly recipient: string;
  readonly template: string;
  readonly purpose: string;
  readonly consentRef: string;
}

/**
 * Sends a templated message for the context's tenant. Every message names its purpose and
 * the consent (or legal basis) behind it, so the privacy desk (K7b) can answer for it.
 */
export interface MessageSender {
  send(context: TenantContext, message: OutboundMessage): Promise<Result<SentMessage, AppError>>;
}

const EMAIL_MAX_LENGTH = 254; // RFC 5321 path limit
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/;
const E164 = /^\+[1-9][0-9]{7,14}$/;

/** Validates a message. Errors name fields only, never the recipient. */
export function prepareMessage(
  message: OutboundMessage,
): Result<PreparedMessage, AppError<'VALIDATION_FAILED'>> {
  const fields: FieldError[] = [];
  const channelKnown = (MESSAGE_CHANNELS as readonly unknown[]).includes(message.channel);
  if (!channelKnown) fields.push({ path: 'channel', code: 'invalid_channel' });
  if (channelKnown && !isRecipient(message.channel, message.to)) {
    fields.push({ path: 'to', code: 'invalid_recipient' });
  }
  if (!isSnakeName(message.template)) fields.push({ path: 'template', code: 'invalid_name' });
  if (!isNonBlankString(message.purpose)) fields.push({ path: 'purpose', code: 'required' });
  if (!isNonBlankString(message.consentRef)) fields.push({ path: 'consentRef', code: 'required' });
  const params: Record<string, string> = {};
  const rawParams: unknown = message.params;
  if (rawParams !== undefined) {
    if (typeof rawParams !== 'object' || rawParams === null || Array.isArray(rawParams)) {
      fields.push({ path: 'params', code: 'invalid_params' });
    } else {
      for (const [key, value] of Object.entries(rawParams)) {
        if (typeof value === 'string') {
          Object.defineProperty(params, key, { value, enumerable: true });
        } else {
          fields.push({ path: `params.${key}`, code: 'not_a_string' });
        }
      }
    }
  }
  if (fields.length > 0) {
    return err(coreError('VALIDATION_FAILED', { fields, detail: 'invalid message' }));
  }
  return ok(
    Object.freeze({
      channel: message.channel,
      to: message.to,
      template: message.template,
      purpose: message.purpose,
      consentRef: message.consentRef,
      ...(message.params === undefined ? {} : { params: Object.freeze(params) }),
    }) as PreparedMessage,
  );
}

/** Enough to recognise a recipient in a list, not enough to contact them. */
export function maskRecipient(channel: MessageChannel, to: string): string {
  if (channel === 'email') {
    // The domain can identify a person (their own domain), so only its last label stays.
    const at = to.lastIndexOf('@');
    const domain = to.slice(at + 1);
    const dot = domain.lastIndexOf('.');
    const tld = dot === -1 ? '' : domain.slice(dot);
    return `${to.slice(0, 1)}***@${domain.slice(0, 1)}***${tld}`;
  }
  return `***${to.slice(-4)}`;
}

function isRecipient(channel: MessageChannel, to: unknown): boolean {
  if (typeof to !== 'string') return false;
  return channel === 'email' ? to.length <= EMAIL_MAX_LENGTH && EMAIL.test(to) : E164.test(to);
}
