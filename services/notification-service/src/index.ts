import { createApp } from './app.js';
import { KafkaConsumerAdapter } from './adapters/kafka-consumer.adapter.js';
import { KafkaProducerAdapter } from './adapters/kafka-producer.adapter.js';
import { PostgresNotificationAdapter } from './adapters/postgres-notification.adapter.js';
import { buildOnboardingNotificationTrigger } from './application/build-onboarding-notification-trigger.application.js';
import { buildPaymentNotificationTrigger } from './application/build-payment-notification-trigger.application.js';
import { buildDeliveryWorker } from './application/build-delivery-worker.application.js';
import { bootstrapOpenTelemetry } from './observability/otel.js';

const SERVICE_NAME = 'notification-service';
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';

async function start(): Promise<void> {
  bootstrapOpenTelemetry(SERVICE_NAME);

  const postgresAdapter = new PostgresNotificationAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const kafkaConsumer = new KafkaConsumerAdapter();

  const trigger = buildPaymentNotificationTrigger({
    postgresAdapter,
    kafkaProducer,
    kafkaConsumer,
    logger: {
      info: (payload: Record<string, unknown>, message: string): void => {
        console.info(JSON.stringify({ level: 'info', service: SERVICE_NAME, message, ...payload }));
      },
      warn: (payload: Record<string, unknown>, message: string): void => {
        console.warn(JSON.stringify({ level: 'warn', service: SERVICE_NAME, message, ...payload }));
      },
      error: (payload: Record<string, unknown>, message: string): void => {
        console.error(JSON.stringify({ level: 'error', service: SERVICE_NAME, message, ...payload }));
      }
    }
  });

  const deliveryWorker = buildDeliveryWorker({
    postgresAdapter,
    kafkaProducer,
    kafkaConsumer,
    logger: {
      info: (payload: Record<string, unknown>, message: string): void => {
        console.info(JSON.stringify({ level: 'info', service: SERVICE_NAME, message, ...payload }));
      },
      warn: (payload: Record<string, unknown>, message: string): void => {
        console.warn(JSON.stringify({ level: 'warn', service: SERVICE_NAME, message, ...payload }));
      },
      error: (payload: Record<string, unknown>, message: string): void => {
        console.error(JSON.stringify({ level: 'error', service: SERVICE_NAME, message, ...payload }));
      }
    }
  });

  const onboardingTrigger = buildOnboardingNotificationTrigger({
    postgresAdapter,
    kafkaProducer,
    kafkaConsumer,
    logger: {
      info: (payload: Record<string, unknown>, message: string): void => {
        console.info(JSON.stringify({ level: 'info', service: SERVICE_NAME, message, ...payload }));
      },
      warn: (payload: Record<string, unknown>, message: string): void => {
        console.warn(JSON.stringify({ level: 'warn', service: SERVICE_NAME, message, ...payload }));
      },
      error: (payload: Record<string, unknown>, message: string): void => {
        console.error(JSON.stringify({ level: 'error', service: SERVICE_NAME, message, ...payload }));
      }
    }
  });
  await trigger.consumer.subscribe();
  await onboardingTrigger.consumer.subscribe();
  await deliveryWorker.subscribe();
  await kafkaConsumer.start();

  const app = createApp();
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const host = process.env.HOST ?? DEFAULT_HOST;

  await app.listen({ port, host });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error: unknown) => {
    // Logging intentionally minimal and does not include sensitive request data.
    console.error('Failed to start notification-service', error);
    process.exit(1);
  });
}
