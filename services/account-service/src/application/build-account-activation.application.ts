import { PostgresAccountAdapter } from '../adapters/postgres-account.adapter.js';
import { RedisIdempotencyAdapter } from '../adapters/redis-idempotency.adapter.js';
import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import { AccountEventsPublisher } from '../events/account.events.js';
import { AuditEventsService } from '../events/audit.events.js';
import { AccountActivationMetrics } from '../events/metrics.js';
import { AccountCreatedActivationConsumer } from '../events/account-created-activation.consumer.js';

import { AccountActivationApplication } from './account-activation.application.js';

export function buildAccountActivationApplication(deps: {
  postgresAdapter?: PostgresAccountAdapter;
  redisAdapter?: RedisIdempotencyAdapter;
  kafkaConsumer?: KafkaConsumerAdapter;
  accountEvents: AccountEventsPublisher;
  auditEvents: AuditEventsService;
  metrics?: AccountActivationMetrics;
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
  };
}): {
  application: AccountActivationApplication;
  consumer: AccountCreatedActivationConsumer;
  metrics: AccountActivationMetrics;
} {
  const postgresAdapter = deps.postgresAdapter ?? new PostgresAccountAdapter();
  const redisAdapter = deps.redisAdapter ?? new RedisIdempotencyAdapter();
  const kafkaConsumer = deps.kafkaConsumer ?? new KafkaConsumerAdapter();
  const metrics = deps.metrics ?? new AccountActivationMetrics();

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

  const application = new AccountActivationApplication(
    postgresAdapter,
    redisAdapter,
    deps.accountEvents,
    deps.auditEvents,
    metrics,
    logger
  );
  const consumer = new AccountCreatedActivationConsumer(kafkaConsumer, application);

  return { application, consumer, metrics };
}
