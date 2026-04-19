import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresCustomerAdapter, type PostgresClient } from '../adapters/postgres-customer.adapter.js';
import { RedisIdempotencyAdapter, type RedisClient } from '../adapters/redis-idempotency.adapter.js';
import { CustomerEventsPublisher } from '../events/customer.events.js';
import { AuditEventsService } from '../events/audit.events.js';
import { CustomerOpsQueryMetrics } from '../events/metrics.js';

import { CustomerApplication } from './customer.application.js';

export function buildCustomerApplication(deps: {
  db: PostgresClient;
  redis: RedisClient;
  kafkaProducer: KafkaProducerAdapter;
}): CustomerApplication {
  const postgresAdapter = new PostgresCustomerAdapter(deps.db);
  const redisIdempotencyAdapter = new RedisIdempotencyAdapter(deps.redis);
  const customerEventsPublisher = new CustomerEventsPublisher(deps.kafkaProducer);
  const auditEventsService = new AuditEventsService(deps.kafkaProducer);
  const opsQueryMetrics = new CustomerOpsQueryMetrics();

  return new CustomerApplication(
    postgresAdapter,
    redisIdempotencyAdapter,
    auditEventsService,
    customerEventsPublisher,
    opsQueryMetrics
  );
}
