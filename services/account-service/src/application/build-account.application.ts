import { FineractAdapterStub } from '../adapters/fineract.adapter.js';
import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresAccountAdapter } from '../adapters/postgres-account.adapter.js';
import { RedisIdempotencyAdapter } from '../adapters/redis-idempotency.adapter.js';
import { AccountEventsPublisher } from '../events/account.events.js';
import { AuditEventsService } from '../events/audit.events.js';
import { AccountOpsQueryMetrics } from '../events/metrics.js';

import { AccountApplication } from './account.application.js';

export function buildAccountApplication(deps?: {
  postgresAdapter?: PostgresAccountAdapter;
  redisAdapter?: RedisIdempotencyAdapter;
  fineractAdapter?: FineractAdapterStub;
  kafkaProducer?: KafkaProducerAdapter;
  auditEventsService?: AuditEventsService;
  accountEventsPublisher?: AccountEventsPublisher;
  metrics?: AccountOpsQueryMetrics;
}): AccountApplication {
  const postgresAdapter = deps?.postgresAdapter ?? new PostgresAccountAdapter();
  const redisIdempotencyAdapter = deps?.redisAdapter ?? new RedisIdempotencyAdapter();
  const fineractAdapter = deps?.fineractAdapter ?? new FineractAdapterStub();
  const kafkaProducer = deps?.kafkaProducer ?? new KafkaProducerAdapter();
  const accountEventsPublisher = new AccountEventsPublisher(kafkaProducer);
  const auditEventsService = deps?.auditEventsService ?? new AuditEventsService();
  const opsQueryMetrics = deps?.metrics ?? new AccountOpsQueryMetrics();

  return new AccountApplication(
    postgresAdapter,
    redisIdempotencyAdapter,
    fineractAdapter,
    auditEventsService,
    deps?.accountEventsPublisher ?? accountEventsPublisher,
    opsQueryMetrics
  );
}
