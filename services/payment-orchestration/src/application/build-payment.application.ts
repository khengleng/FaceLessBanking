import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresPaymentAdapter } from '../adapters/postgres-payment.adapter.js';
import { RedisIdempotencyAdapter } from '../adapters/redis-idempotency.adapter.js';
import { AuditEventsService } from '../events/audit.events.js';
import { PaymentEventsPublisher } from '../events/payment.events.js';
import { PaymentMetrics } from '../events/metrics.js';

import { PaymentApplication } from './payment.application.js';

export function buildPaymentApplication(deps?: {
  postgresAdapter?: PostgresPaymentAdapter;
  redisAdapter?: RedisIdempotencyAdapter;
  kafkaProducer?: KafkaProducerAdapter;
  auditEvents?: AuditEventsService;
  paymentEvents?: PaymentEventsPublisher;
  metrics?: PaymentMetrics;
}): PaymentApplication {
  const postgresAdapter = deps?.postgresAdapter ?? new PostgresPaymentAdapter();
  const redisIdempotencyAdapter = deps?.redisAdapter ?? new RedisIdempotencyAdapter();
  const kafkaProducer = deps?.kafkaProducer ?? new KafkaProducerAdapter();
  const auditEvents = deps?.auditEvents ?? new AuditEventsService();
  const paymentEvents = deps?.paymentEvents ?? new PaymentEventsPublisher(kafkaProducer);
  const metrics = deps?.metrics ?? new PaymentMetrics();

  return new PaymentApplication(
    postgresAdapter,
    redisIdempotencyAdapter,
    auditEvents,
    paymentEvents,
    metrics
  );
}
