import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import { PostgresAccountAdapter } from '../adapters/postgres-account.adapter.js';
import { AccountEventsPublisher } from '../events/account.events.js';
import { AuditEventsService } from '../events/audit.events.js';
import { CustomerAccountCreationMetrics } from '../events/metrics.js';
import { CustomerCreatedConsumer } from '../events/customer-created.consumer.js';

import { CustomerAccountCreationApplication } from './customer-account-creation.application.js';

export function buildCustomerAccountCreationApplication(deps: {
  postgresAdapter?: PostgresAccountAdapter;
  kafkaConsumer?: KafkaConsumerAdapter;
  accountEvents: AccountEventsPublisher;
  auditEvents: AuditEventsService;
  metrics?: CustomerAccountCreationMetrics;
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
  };
}): {
  application: CustomerAccountCreationApplication;
  consumer: CustomerCreatedConsumer;
  metrics: CustomerAccountCreationMetrics;
} {
  const postgresAdapter = deps.postgresAdapter ?? new PostgresAccountAdapter();
  const kafkaConsumer = deps.kafkaConsumer ?? new KafkaConsumerAdapter();
  const metrics = deps.metrics ?? new CustomerAccountCreationMetrics();

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

  const application = new CustomerAccountCreationApplication(
    postgresAdapter,
    deps.accountEvents,
    deps.auditEvents,
    metrics,
    logger
  );
  const consumer = new CustomerCreatedConsumer(kafkaConsumer, application);

  return { application, consumer, metrics };
}
