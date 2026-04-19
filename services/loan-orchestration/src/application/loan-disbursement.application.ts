import { randomUUID } from 'node:crypto';

import type { PaymentAdapter } from '../adapters/payment.adapter.js';
import type { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import {
  parseLoanAccountCreatedEvent
} from '../domain/loan-account-created-event.js';
import { canTransitionLoanStatus } from '../domain/loan.js';
import type { LoanEventsPublisher } from '../events/loan.events.js';
import type { LoanDisbursementMetrics } from '../events/metrics.js';

export type ProcessLoanAccountCreatedResult =
  | { kind: 'disbursement_initiated'; paymentId: string }
  | { kind: 'duplicate_event' }
  | { kind: 'invalid_event'; reason: string }
  | { kind: 'loan_not_found' }
  | { kind: 'invalid_state'; status: string };

export class LoanDisbursementApplication {
  constructor(
    private readonly postgresAdapter: PostgresLoanAdapter,
    private readonly paymentAdapter: PaymentAdapter,
    private readonly loanEvents: LoanEventsPublisher,
    private readonly metrics: LoanDisbursementMetrics,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    },
    private readonly fallbackFundingAccountId: string
  ) {}

  async processLoanAccountCreated(rawEvent: unknown): Promise<ProcessLoanAccountCreatedResult> {
    const event = parseLoanAccountCreatedEvent(rawEvent);
    if (!event) {
      return { kind: 'invalid_event', reason: 'invalid_event_envelope' };
    }

    const { eventId, correlationId } = event.metadata;
    const loanAccountId = String(event.payload.loanAccountId ?? event.payload.loanId);

    const alreadyProcessed = await this.postgresAdapter.hasProcessedDisbursementEvent(eventId);
    if (alreadyProcessed) {
      this.metrics.recordDuplicateDisbursementEventSkipped();
      this.logger.info({ eventId, correlationId, loanAccountId }, 'Skipping duplicate disbursement event');
      return { kind: 'duplicate_event' };
    }

    const loanAccount = await this.postgresAdapter.getLoanAccountById(loanAccountId);
    if (!loanAccount) {
      return { kind: 'loan_not_found' };
    }

    if (loanAccount.status !== 'CREATED' || !canTransitionLoanStatus(loanAccount.status, 'DISBURSEMENT_PENDING')) {
      this.metrics.recordInvalidStateTransitionBlocked();
      this.logger.warn(
        { eventId, correlationId, loanAccountId, status: loanAccount.status },
        'Blocked loan disbursement due to invalid state transition'
      );
      return { kind: 'invalid_state', status: loanAccount.status };
    }

    const amountCents = event.payload.disbursementAmountCents
      ?? event.payload.principalCents
      ?? loanAccount.principalCents;
    const currency = event.payload.currency ?? loanAccount.currency;
    const sourceAccountId = event.payload.fundingAccountId ?? this.fallbackFundingAccountId;
    const destinationAccountId = event.payload.customerAccountId;

    const idempotencyKey = `loan-disbursement:${loanAccountId}`;
    const payment = await this.paymentAdapter.initiateTransfer({
      sourceAccountId,
      destinationAccountId,
      amountCents,
      currency,
      idempotencyKey,
      correlationId,
      channel: 'loan-disbursement'
    });

    await this.postgresAdapter.createDisbursementRequest({
      disbursementRequestId: randomUUID(),
      loanAccountId,
      sourceAccountId,
      destinationAccountId,
      amountCents,
      currency,
      paymentId: payment.paymentId,
      correlationId,
      createdAt: new Date().toISOString()
    });
    await this.postgresAdapter.updateLoanAccountStatus(loanAccountId, 'DISBURSEMENT_PENDING');
    await this.postgresAdapter.markDisbursementEventProcessed(eventId);
    await this.loanEvents.emitLoanDisbursementInitiated({
      loanId: loanAccountId,
      paymentId: payment.paymentId,
      sourceAccountId,
      destinationAccountId,
      amountCents,
      currency,
      correlationId,
      sourceEventId: eventId
    });

    this.metrics.recordDisbursementTriggered();
    this.logger.info(
      { eventId, correlationId, loanAccountId, paymentId: payment.paymentId },
      'Loan disbursement initiated via payment service'
    );

    return { kind: 'disbursement_initiated', paymentId: payment.paymentId };
  }
}
