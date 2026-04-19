import type { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import { PostgresCustomerAdapter, type PostgresClient } from '../adapters/postgres-customer.adapter.js';
import { CustomerEventsPublisher } from '../events/customer.events.js';
import { AuditEventsService } from '../events/audit.events.js';
import { OnboardingCustomerCreationMetrics } from '../events/metrics.js';
import { OnboardingApprovedConsumer } from '../events/onboarding-approved.consumer.js';

import { OnboardingCustomerCreationApplication } from './onboarding-customer-creation.application.js';

export function buildOnboardingCustomerCreation(deps: {
  db: PostgresClient;
  kafkaProducer: KafkaProducerAdapter;
  kafkaConsumer?: KafkaConsumerAdapter;
  metrics?: OnboardingCustomerCreationMetrics;
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
  };
}): {
  application: OnboardingCustomerCreationApplication;
  consumer: OnboardingApprovedConsumer;
  metrics: OnboardingCustomerCreationMetrics;
} {
  const postgresAdapter = new PostgresCustomerAdapter(deps.db);
  const customerEventsPublisher = new CustomerEventsPublisher(deps.kafkaProducer);
  const auditEventsService = new AuditEventsService(deps.kafkaProducer);
  const kafkaConsumer = deps.kafkaConsumer ?? new KafkaConsumerAdapter();
  const metrics = deps.metrics ?? new OnboardingCustomerCreationMetrics();

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

  const application = new OnboardingCustomerCreationApplication(
    postgresAdapter,
    customerEventsPublisher,
    auditEventsService,
    metrics,
    logger
  );

  const consumer = new OnboardingApprovedConsumer(kafkaConsumer, application);

  return {
    application,
    consumer,
    metrics
  };
}
