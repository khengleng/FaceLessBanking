import type { KafkaAmlAdapter } from '../adapters/kafka-aml.adapter.js';
import type { PostgresAmlAdapter } from '../adapters/postgres-aml.adapter.js';
import type { AMLAlert } from '../domain/aml-alert.js';
import { evaluateAmlRules, type PaymentEventContext } from '../domain/aml-rules.js';
import type { AMLMetrics } from '../events/metrics.js';

type Logger = {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

export type ProcessPaymentEventResult =
  | { kind: 'processed'; alertsCreated: number }
  | { kind: 'duplicate_event' }
  | { kind: 'ignored_event' }
  | { kind: 'invalid_event'; reason: string };

export class AMLMonitoringApplication {
  constructor(
    private readonly postgresAdapter: PostgresAmlAdapter,
    private readonly kafkaAdapter: KafkaAmlAdapter,
    private readonly metrics: AMLMetrics,
    private readonly logger: Logger
  ) {}

  async listAlerts(): Promise<AMLAlert[]> {
    return this.postgresAdapter.listAmlAlerts();
  }

  async getAlertById(alertId: string): Promise<AMLAlert | null> {
    return this.postgresAdapter.getAmlAlertById(alertId);
  }

  async processPaymentEvent(rawEvent: unknown): Promise<ProcessPaymentEventResult> {
    const context = parsePaymentEvent(rawEvent);
    if (!context) {
      this.metrics.recordMalformedEventRejected();
      return { kind: 'invalid_event', reason: 'invalid_event_envelope' };
    }

    this.metrics.recordEventEvaluated();

    const alreadyProcessed = await this.postgresAdapter.hasProcessedAmlEvent(context.sourceEventId);
    if (alreadyProcessed) {
      this.metrics.recordDuplicateEventSkipped();
      this.logger.info(
        { sourceEventId: context.sourceEventId, correlationId: context.correlationId },
        'Skipping duplicate AML event'
      );
      return { kind: 'duplicate_event' };
    }

    // For status updates, evaluate AML rules only when money movement is relevant.
    if (context.eventType === 'payment.status.updated.v1' && !context.isRelevantStatus) {
      await this.postgresAdapter.markAmlEventProcessed(context.sourceEventId);
      return { kind: 'ignored_event' };
    }

    const recentCount = await this.postgresAdapter.recordTransactionAndGetRecentCount({
      sourceAccountId: context.sourceAccountId,
      customerId: context.customerId,
      windowMs: 5 * 60 * 1000
    });

    const candidates = evaluateAmlRules({
      context,
      recentTransactionCountForEntity: recentCount
    });

    let alertsCreated = 0;
    for (const candidate of candidates) {
      const alert = await this.postgresAdapter.createAmlAlert(candidate);
      await this.kafkaAdapter.publishAmlAlert({
        alert,
        correlationId: context.correlationId
      });
      alertsCreated += 1;
    }

    await this.postgresAdapter.markAmlEventProcessed(context.sourceEventId);
    if (alertsCreated > 0) {
      this.metrics.recordAlertCreated(alertsCreated);
    }

    this.logger.info(
      {
        sourceEventId: context.sourceEventId,
        correlationId: context.correlationId,
        alertsCreated
      },
      'Processed payment event for AML evaluation'
    );

    return { kind: 'processed', alertsCreated };
  }
}

type ParsedPaymentEvent = PaymentEventContext & {
  isRelevantStatus: boolean;
};

function parsePaymentEvent(rawEvent: unknown): ParsedPaymentEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;
  const type = event.type;
  if (type !== 'payment.initiated.v1' && type !== 'payment.status.updated.v1') {
    return null;
  }

  const metadata = event.metadata as Record<string, unknown> | undefined;
  const payload = event.payload as Record<string, unknown> | undefined;
  if (!metadata || !payload) {
    return null;
  }

  const eventId = metadata.eventId;
  const correlationId = metadata.correlationId;
  if (typeof eventId !== 'string' || typeof correlationId !== 'string') {
    return null;
  }

  const paymentId = payload.paymentId;
  const sourceAccountId = payload.sourceAccountId;
  const amount = payload.amount;
  const currency = payload.currency;

  if (
    typeof paymentId !== 'string'
    || typeof sourceAccountId !== 'string'
    || typeof amount !== 'number'
    || typeof currency !== 'string'
  ) {
    return null;
  }

  const customerId = typeof payload.customerId === 'string' ? payload.customerId : sourceAccountId;
  const countryCode = typeof payload.countryCode === 'string' ? payload.countryCode : undefined;
  const status = typeof payload.status === 'string' ? payload.status : undefined;

  return {
    sourceEventId: eventId,
    correlationId,
    paymentId,
    sourceAccountId,
    customerId,
    amount,
    currency,
    countryCode,
    eventType: type,
    isRelevantStatus: status === undefined || status === 'COMPLETED'
  };
}
