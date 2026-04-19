import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import { PostgresAuditAdapter } from '../adapters/postgres-audit.adapter.js';
import { PaymentLifecycleConsumer } from '../events/payment-lifecycle.consumer.js';
import { AuditLifecycleMetrics } from '../events/metrics.js';

import { PaymentAuditEnricherApplication } from './payment-audit-enricher.application.js';

export function buildPaymentAuditEnricher(deps?: {
  auditAdapter?: PostgresAuditAdapter;
  kafkaConsumer?: KafkaConsumerAdapter;
  metrics?: AuditLifecycleMetrics;
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
  };
}): {
  enricher: PaymentAuditEnricherApplication;
  consumer: PaymentLifecycleConsumer;
  metrics: AuditLifecycleMetrics;
} {
  const auditAdapter = deps?.auditAdapter ?? new PostgresAuditAdapter();
  const kafkaConsumer = deps?.kafkaConsumer ?? new KafkaConsumerAdapter();
  const metrics = deps?.metrics ?? new AuditLifecycleMetrics();

  const logger = deps?.logger ?? {
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

  const enricher = new PaymentAuditEnricherApplication(
    auditAdapter,
    metrics,
    logger
  );

  const consumer = new PaymentLifecycleConsumer(kafkaConsumer, enricher);

  return {
    enricher,
    consumer,
    metrics
  };
}
