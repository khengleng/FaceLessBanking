import type { EventEnvelope } from '@faceless-banking/shared-events';

export type LoanAccountCreatedEvent = EventEnvelope<
  'loan.account.created.v1',
  {
    loanAccountId?: string;
    loanId?: string;
    customerAccountId: string;
    fundingAccountId?: string;
    disbursementAmountCents?: number;
    principalCents?: number;
    currency?: string;
  }
>;

export function parseLoanAccountCreatedEvent(rawEvent: unknown): LoanAccountCreatedEvent | null {
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

  if (typeof payload.customerAccountId !== 'string' || payload.customerAccountId.length === 0) {
    return null;
  }

  const loanAccountId = payload.loanAccountId ?? payload.loanId;
  if (typeof loanAccountId !== 'string' || loanAccountId.length === 0) {
    return null;
  }

  if (
    payload.disbursementAmountCents !== undefined
    && (typeof payload.disbursementAmountCents !== 'number' || payload.disbursementAmountCents <= 0)
  ) {
    return null;
  }

  if (
    payload.principalCents !== undefined
    && (typeof payload.principalCents !== 'number' || payload.principalCents <= 0)
  ) {
    return null;
  }

  if (payload.currency !== undefined && typeof payload.currency !== 'string') {
    return null;
  }

  return event as LoanAccountCreatedEvent;
}
