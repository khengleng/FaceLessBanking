import { createApp } from './app.js';
import pg from 'pg';
import { Redis } from 'ioredis';

import { KafkaConsumerAdapter } from './adapters/kafka-consumer.adapter.js';
import { KafkaProducerAdapter } from './adapters/kafka-producer.adapter.js';
import { buildOnboardingCustomerCreation } from './application/build-onboarding-customer-creation.application.js';
import { bootstrapOpenTelemetry } from './observability/otel.js';

const SERVICE_NAME = 'customer-service';
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';

async function start(): Promise<void> {
  bootstrapOpenTelemetry(SERVICE_NAME);

  const db = new pg.Pool({
    connectionString: process.env.DATABASE_URL
  });
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const kafkaProducer = new KafkaProducerAdapter();
  const kafkaConsumer = new KafkaConsumerAdapter();

  const onboardingFlow = buildOnboardingCustomerCreation({
    db,
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

  await onboardingFlow.consumer.subscribe();
  await onboardingFlow.consumer.start();

  const app = createApp({
    db,
    redis,
    kafkaProducer
  });
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const host = process.env.HOST ?? DEFAULT_HOST;

  await app.listen({ port, host });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error: unknown) => {
    // Logging intentionally minimal and does not include sensitive request data.
    console.error('Failed to start customer-service', error);
    process.exit(1);
  });
}
