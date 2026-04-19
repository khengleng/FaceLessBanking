import type { EventEnvelope } from '@faceless-banking/shared-events';

export const BALANCE_SNAPSHOT_INIT_STAGE = 'balance_snapshot_init';

export type AccountActivatedEvent = EventEnvelope<
  'account.activated.v1',
  {
    accountId: string;
    customerId?: string;
    oldStatus?: string;
    newStatus?: string;
    currency?: string;
    accountType?: string;
  }
>;

export function parseAccountActivatedEvent(rawEvent: unknown): AccountActivatedEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;
  if (event.specVersion !== '1.0') {
    return null;
  }

  if (event.type !== 'account.activated.v1') {
    return null;
  }

  if (typeof event.version !== 'number') {
    return null;
  }

  const metadata = event.metadata as Record<string, unknown> | undefined;
  const payload = event.payload as Record<string, unknown> | undefined;

  if (!metadata || !payload) {
    return null;
  }

  if (
    typeof metadata.eventId !== 'string'
    || typeof metadata.correlationId !== 'string'
    || typeof metadata.timestamp !== 'string'
    || typeof metadata.producer !== 'string'
  ) {
    return null;
  }

  if (typeof payload.accountId !== 'string' || payload.accountId.length === 0) {
    return null;
  }

  if (payload.currency !== undefined && typeof payload.currency !== 'string') {
    return null;
  }

  return event as AccountActivatedEvent;
}
