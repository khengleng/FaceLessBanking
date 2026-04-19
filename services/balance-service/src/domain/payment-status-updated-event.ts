import type { EventEnvelope } from '@faceless-banking/shared-events';

export type PaymentStatusUpdatedEvent = EventEnvelope<
  'payment.status.updated.v1',
  {
    paymentId: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    currency: string;
    previousStatus: string;
    status: string;
    reason: string;
  }
>;

export const BALANCE_PROJECTION_STAGE = 'balance-projection-updater.v1';
