import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresNotificationAdapter } from '../adapters/postgres-notification.adapter.js';
import { NotificationTriggerMetrics } from '../events/metrics.js';
import { NotificationEventsPublisher } from '../events/notification.events.js';
import { PaymentStatusConsumer } from '../events/payment-status.consumer.js';

import { PaymentNotificationTriggerApplication } from './payment-notification-trigger.application.js';

export function buildPaymentNotificationTrigger(deps?: {
  postgresAdapter?: PostgresNotificationAdapter;
  kafkaProducer?: KafkaProducerAdapter;
  kafkaConsumer?: KafkaConsumerAdapter;
  metrics?: NotificationTriggerMetrics;
  defaultChannel?: 'push' | 'sms' | 'email';
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
  };
}): {
  triggerApplication: PaymentNotificationTriggerApplication;
  consumer: PaymentStatusConsumer;
  metrics: NotificationTriggerMetrics;
} {
  const postgresAdapter = deps?.postgresAdapter ?? new PostgresNotificationAdapter();
  const kafkaProducer = deps?.kafkaProducer ?? new KafkaProducerAdapter();
  const kafkaConsumer = deps?.kafkaConsumer ?? new KafkaConsumerAdapter();
  const metrics = deps?.metrics ?? new NotificationTriggerMetrics();

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

  const notificationEvents = new NotificationEventsPublisher(kafkaProducer);
  const triggerApplication = new PaymentNotificationTriggerApplication(
    postgresAdapter,
    notificationEvents,
    metrics,
    deps?.defaultChannel ?? 'push',
    logger
  );

  const consumer = new PaymentStatusConsumer(kafkaConsumer, triggerApplication);

  return {
    triggerApplication,
    consumer,
    metrics
  };
}
