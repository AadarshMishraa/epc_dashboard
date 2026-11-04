import type { TenantContext } from '../context.ts';
import { coreError, type AppError } from '../errors.ts';
import type { Id } from '../ids.ts';
import type { Result } from '../result.ts';

export type MessageChannel = 'email' | 'sms' | 'whatsapp' | 'push';

export interface OutgoingMessage {
  readonly channel: MessageChannel;
  /** Address on the channel; personal data, so adapters store it masked. */
  readonly to: string;
  /** Approved template id, for example `invoice_due_v2`; free text is never sent. */
  readonly template: string;
  readonly params: Readonly<Record<string, string>>;
  /** Why this message is sent, for example `payment_reminder`. */
  readonly purpose: string;
  /** The consent record, or the lawful basis for a transactional message (`basis:contract`). */
  readonly consentRef: string;
}

/** Sends through a provider adapter (WhatsApp, SMS, email) with the consent gate. Implemented by P1. */
export interface MessageSender {
  send(
    context: TenantContext,
    message: OutgoingMessage,
  ): Promise<Result<{ readonly messageId: Id }, AppError>>;
}

const TEMPLATE = /^[a-z][a-z0-9_]{0,63}$/;

/** The checks every MessageSender makes first: a purpose, a consent reference and an approved template id. */
export function validateOutgoing(
  message: OutgoingMessage,
): AppError<'VALIDATION_FAILED'> | undefined {
  const fields = [
    ...(message.to.trim() === '' ? [{ path: 'to', code: 'REQUIRED' }] : []),
    ...(message.purpose.trim() === '' ? [{ path: 'purpose', code: 'REQUIRED' }] : []),
    ...(message.consentRef.trim() === '' ? [{ path: 'consentRef', code: 'REQUIRED' }] : []),
    ...(TEMPLATE.test(message.template) ? [] : [{ path: 'template', code: 'INVALID' }]),
  ];
  return fields.length === 0 ? undefined : coreError('VALIDATION_FAILED', { fields });
}

/** Shorter than this, an address is masked completely. */
const MIN_PARTLY_VISIBLE = 5;

/** Keeps only the last 2 characters (by code point) of an address, for stores and logs. */
export function maskAddress(address: string): string {
  const chars = Array.from(address);
  if (chars.length < MIN_PARTLY_VISIBLE) return '*'.repeat(chars.length);
  return `${'*'.repeat(Math.min(chars.length - 2, 8))}${chars.slice(-2).join('')}`;
}
