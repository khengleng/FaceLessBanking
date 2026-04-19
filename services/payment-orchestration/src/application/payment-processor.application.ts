import type { EventEnvelope } from '@faceless-banking/shared-events';

import type { PostgresPaymentAdapter } from '../adapters/postgres-payment.adapter.js';
import type { AuditEventsService } from '../events/audit.events.js';
import type { PaymentEventsPublisher } from '../events/payment.events.js';
import type { PaymentMetrics } from '../events/metrics.js';
import type { PaymentStatus } from '../domain/payment.js';
import {
  canTransitionPaymentStatus,
  isProcessorStartState,
  PAYMENT_PROCESSOR_STAGE
} from '../domain/payment-transition.js';

export type PaymentInitiatedProcessorEvent = EventEnvelope<
  'payment.initiated.v1',
  {
    paymentId: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    currency: string;
    channel: string;
  }
>;

export type ProcessPaymentInitiatedResult =
  | { kind: 'processed'; finalStatus: 'COMPLETED' | 'FAILED' }
  | { kind: 'duplicate_event' }
  | { kind: 'invalid_event'; reason: string }
  | { kind: 'payment_not_found' }
  | { kind: 'invalid_transition'; currentStatus: PaymentStatus };

export type PaymentProcessorHooks = {
  runFraudChecks: (input: {
    paymentId: string;
    correlationId: string;
  }) => Promise<void>;
  postToCoreBanking: (input: {
    paymentId: string;
    correlationId: string;
  }) => Promise<void>;
  requestLedgerAnchor: (input: {
    paymentId: string;
    correlationId: string;
    status: 'COMPLETED' | 'FAILED';
  }) => Promise<void>;
  triggerNotification: (input: {
    paymentId: string;
    correlationId: string;
    status: 'COMPLETED' | 'FAILED';
  }) => Promise<void>;
};

export class PaymentProcessorApplication {
  constructor(
    private readonly postgresAdapter: PostgresPaymentAdapter,
    private readonly auditEvents: AuditEventsService,
    private readonly paymentEvents: PaymentEventsPublisher,
    private readonly metrics: PaymentMetrics,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    },
    private readonly hooks: PaymentProcessorHooks
  ) {}

  async processPaymentInitiated(
    rawEvent: unknown
  ): Promise<ProcessPaymentInitiatedResult> {
    const event = parsePaymentInitiatedEnvelope(rawEvent);
    if (!event) {
      return { kind: 'invalid_event', reason: 'invalid_event_envelope' };
    }

    const { eventId, correlationId } = event.metadata;

    const alreadyProcessed = await this.postgresAdapter.hasProcessedConsumerEvent(
      eventId,
      PAYMENT_PROCESSOR_STAGE
    );

    if (alreadyProcessed) {
      this.metrics.recordDuplicateConsumerEventSkipped();
      this.logger.info(
        { eventId, correlationId, stage: PAYMENT_PROCESSOR_STAGE },
        'Skipping duplicate processor event'
      );
      return { kind: 'duplicate_event' };
    }

    const payment = await this.postgresAdapter.getPaymentById(event.payload.paymentId);
    if (!payment) {
      this.logger.warn(
        { eventId, correlationId, paymentId: event.payload.paymentId },
        'Payment not found for processor event'
      );
      return { kind: 'payment_not_found' };
    }

    if (!isProcessorStartState(payment.status)) {
      this.logger.warn(
        {
          eventId,
          correlationId,
          paymentId: payment.paymentId,
          currentStatus: payment.status
        },
        'Invalid state transition attempt for processor stage'
      );
      return { kind: 'invalid_transition', currentStatus: payment.status };
    }

    if (!canTransitionPaymentStatus(payment.status, 'PROCESSING')) {
      return { kind: 'invalid_transition', currentStatus: payment.status };
    }

    await this.postgresAdapter.updatePaymentStatus(payment.paymentId, 'PROCESSING', {
      eventId,
      correlationId,
      stage: PAYMENT_PROCESSOR_STAGE
    });
    await this.auditEvents.createPaymentStatusUpdatedAuditRecord(
      payment.paymentId,
      payment.status,
      'PROCESSING',
      eventId,
      correlationId
    );
    await this.paymentEvents.emitPaymentStatusUpdated({
      paymentId: payment.paymentId,
      sourceAccountId: payment.sourceAccountId,
      destinationAccountId: payment.destinationAccountId,
      amount: payment.amount,
      currency: payment.currency,
      previousStatus: payment.status,
      status: 'PROCESSING',
      correlationId,
      eventId,
      reason: 'processor_started'
    });
    this.metrics.recordPaymentsProcessingStarted();

    await this.hooks.runFraudChecks({
      paymentId: payment.paymentId,
      correlationId
    });
    await this.hooks.postToCoreBanking({
      paymentId: payment.paymentId,
      correlationId
    });

    const placeholderFailure = shouldFailPlaceholderValidation(event);
    const finalStatus: 'COMPLETED' | 'FAILED' = placeholderFailure ? 'FAILED' : 'COMPLETED';

    if (!canTransitionPaymentStatus('PROCESSING', finalStatus)) {
      return { kind: 'invalid_transition', currentStatus: 'PROCESSING' };
    }

    await this.postgresAdapter.updatePaymentStatus(payment.paymentId, finalStatus, {
      eventId,
      correlationId,
      stage: PAYMENT_PROCESSOR_STAGE
    });
    await this.auditEvents.createPaymentStatusUpdatedAuditRecord(
      payment.paymentId,
      'PROCESSING',
      finalStatus,
      eventId,
      correlationId
    );
    await this.paymentEvents.emitPaymentStatusUpdated({
      paymentId: payment.paymentId,
      sourceAccountId: payment.sourceAccountId,
      destinationAccountId: payment.destinationAccountId,
      amount: payment.amount,
      currency: payment.currency,
      previousStatus: 'PROCESSING',
      status: finalStatus,
      correlationId,
      eventId,
      reason: placeholderFailure ? 'placeholder_validation_failed' : 'processed_successfully'
    });
    await this.hooks.requestLedgerAnchor({
      paymentId: payment.paymentId,
      correlationId,
      status: finalStatus
    });
    await this.hooks.triggerNotification({
      paymentId: payment.paymentId,
      correlationId,
      status: finalStatus
    });

    if (finalStatus === 'COMPLETED') {
      this.metrics.recordPaymentsCompleted();
    } else {
      this.metrics.recordPaymentsFailed();
    }

    await this.postgresAdapter.markConsumerEventProcessed(eventId, PAYMENT_PROCESSOR_STAGE);

    this.logger.info(
      {
        eventId,
        correlationId,
        paymentId: payment.paymentId,
        finalStatus
      },
      'Processed payment.initiated.v1 event'
    );

    return { kind: 'processed', finalStatus };
  }
}

function parsePaymentInitiatedEnvelope(rawEvent: unknown): PaymentInitiatedProcessorEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;
  if (event.specVersion !== '1.0') {
    return null;
  }

  if (event.type !== 'payment.initiated.v1') {
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

  if (
    typeof payload.paymentId !== 'string'
    || typeof payload.sourceAccountId !== 'string'
    || typeof payload.destinationAccountId !== 'string'
    || typeof payload.amount !== 'number'
    || typeof payload.currency !== 'string'
    || typeof payload.channel !== 'string'
  ) {
    return null;
  }

  return event as PaymentInitiatedProcessorEvent;
}

function shouldFailPlaceholderValidation(event: PaymentInitiatedProcessorEvent): boolean {
  if (event.payload.amount <= 0) {
    return true;
  }

  if (event.payload.sourceAccountId === event.payload.destinationAccountId) {
    return true;
  }

  return false;
}
