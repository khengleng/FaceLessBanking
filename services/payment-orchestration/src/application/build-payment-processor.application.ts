import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import { PostgresPaymentAdapter } from '../adapters/postgres-payment.adapter.js';
import { PaymentProcessorConsumer } from '../events/payment-processor.consumer.js';
import { AuditEventsService } from '../events/audit.events.js';
import { PaymentMetrics } from '../events/metrics.js';
import { PaymentEventsPublisher } from '../events/payment.events.js';

import {
  PaymentProcessorApplication,
  type PaymentProcessorHooks
} from './payment-processor.application.js';

const noopHooks: PaymentProcessorHooks = {
  async runFraudChecks(): Promise<void> {
    // TODO: integrate fraud-risk-engine checks.
  },
  async postToCoreBanking(): Promise<void> {
    // TODO: integrate Fineract posting.
  },
  async requestLedgerAnchor(): Promise<void> {
    // TODO: integrate ledger anchor workflow.
  },
  async triggerNotification(): Promise<void> {
    // TODO: integrate notification publishing.
  }
};

export function buildPaymentProcessor(deps: {
  postgresAdapter: PostgresPaymentAdapter;
  kafkaConsumer: KafkaConsumerAdapter;
  auditEvents: AuditEventsService;
  paymentEvents: PaymentEventsPublisher;
  metrics: PaymentMetrics;
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
  };
  hooks?: PaymentProcessorHooks;
}): {
  processor: PaymentProcessorApplication;
  consumer: PaymentProcessorConsumer;
} {
  const logger = deps.logger ?? {
    info: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    },
    warn: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    },
    error: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    }
  };

  const processor = new PaymentProcessorApplication(
    deps.postgresAdapter,
    deps.auditEvents,
    deps.paymentEvents,
    deps.metrics,
    logger,
    deps.hooks ?? noopHooks
  );

  const consumer = new PaymentProcessorConsumer(deps.kafkaConsumer, processor);

  return { processor, consumer };
}
