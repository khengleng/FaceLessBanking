import type { EventEnvelope } from '@faceless-banking/shared-events';

export type LoanAccountCreatedScheduleTriggerEvent = EventEnvelope<
  'loan.account.created.v1',
  {
    loanAccountId?: string;
    loanId?: string;
  }
>;

export function parseLoanScheduleTriggerEvent(rawEvent: unknown): LoanAccountCreatedScheduleTriggerEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;

  if (event.specVersion !== '1.0' || event.type !== 'loan.account.created.v1') {
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

  const loanAccountId = payload.loanAccountId ?? payload.loanId;
  if (typeof loanAccountId !== 'string' || loanAccountId.length === 0) {
    return null;
  }

  return event as LoanAccountCreatedScheduleTriggerEvent;
}
