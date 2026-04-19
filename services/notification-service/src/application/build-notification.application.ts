import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresNotificationAdapter } from '../adapters/postgres-notification.adapter.js';
import { EmailProviderAdapterStub } from '../adapters/provider-email.adapter.js';
import { PushProviderAdapterStub } from '../adapters/provider-push.adapter.js';
import { SmsProviderAdapterStub } from '../adapters/provider-sms.adapter.js';
import { NotificationEventsPublisher } from '../events/notification.events.js';

import { NotificationApplication } from './notification.application.js';

export function buildNotificationApplication(): NotificationApplication {
  const postgresAdapter = new PostgresNotificationAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const smsProvider = new SmsProviderAdapterStub();
  const emailProvider = new EmailProviderAdapterStub();
  const pushProvider = new PushProviderAdapterStub();
  const notificationEvents = new NotificationEventsPublisher(kafkaProducer);

  return new NotificationApplication(
    postgresAdapter,
    smsProvider,
    emailProvider,
    pushProvider,
    notificationEvents
  );
}
