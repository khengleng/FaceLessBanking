import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import { PostgresPaymentAdapter } from '../adapters/postgres-payment.adapter.js';
import { PaymentProcessorConsumer } from '../events/payment-processor.consumer.js';
import { AuditEventsService } from '../events/audit.events.js';
import { PaymentMetrics } from '../events/metrics.js';
import { PaymentEventsPublisher } from '../events/payment.events.js';
import { IntegratedHooksAdapter } from '../adapters/integrated-hooks.adapter.js';

import {
  PaymentProcessorApplication,
  type PaymentProcessorHooks
} from './payment-processor.application.js';

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
      console.info(JSON.stringify({ level: 'info', ...payload, message }));
    },
    warn: (payload: Record<string, unknown>, message: string): void => {
      console.warn(JSON.stringify({ level: 'warn', ...payload, message }));
    },
    error: (payload: Record<string, unknown>, message: string): void => {
      console.error(JSON.stringify({ level: 'error', ...payload, message }));
    }
  };

  const hooks = deps.hooks ?? new IntegratedHooksAdapter({
    fraudServiceUrl: process.env.FRAUD_SERVICE_URL || 'http://fraud-risk-engine:3000',
    accountingServiceUrl: process.env.ACCOUNTING_SERVICE_URL || 'http://accounting-service:3000',
    ledgerServiceUrl: process.env.LEDGER_SERVICE_URL || 'http://ledger-service:3000',
    notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3000',
  }, logger);


  const processor = new PaymentProcessorApplication(
    deps.postgresAdapter,
    deps.auditEvents,
    deps.paymentEvents,
    deps.metrics,
    logger,
    hooks
  );

  const consumer = new PaymentProcessorConsumer(deps.kafkaConsumer, processor);

  return { processor, consumer };
}
