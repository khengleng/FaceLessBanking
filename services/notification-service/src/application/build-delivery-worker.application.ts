import { PostgresNotificationAdapter } from '../adapters/postgres-notification.adapter.js';
import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import { SmsProviderAdapterStub } from '../adapters/provider-sms.adapter.js';
import { EmailProviderAdapterStub } from '../adapters/provider-email.adapter.js';
import { PushProviderAdapterStub } from '../adapters/provider-push.adapter.js';
import { NotificationEventsPublisher } from '../events/notification.events.js';
import { DeliveryWorkerApplication } from './delivery-worker.application.js';
import { NotificationRequestedConsumer } from '../events/notification-requested.consumer.js';

export function buildDeliveryWorker(params: {
  postgresAdapter: PostgresNotificationAdapter;
  kafkaProducer: KafkaProducerAdapter;
  kafkaConsumer: KafkaConsumerAdapter;
  logger: {
    info: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
  };
}) {
  const eventPublisher = new NotificationEventsPublisher(params.kafkaProducer);
  const smsProvider = new SmsProviderAdapterStub();
  const emailProvider = new EmailProviderAdapterStub();
  const pushProvider = new PushProviderAdapterStub();

  const application = new DeliveryWorkerApplication(
    params.postgresAdapter,
    eventPublisher,
    smsProvider,
    emailProvider,
    pushProvider,
    params.logger
  );

  const consumer = new NotificationRequestedConsumer(application);

  return {
    application,
    subscribe: async () => {
      await params.kafkaConsumer.subscribeNotificationRequested(consumer.handle.bind(consumer));
    }
  };
}
