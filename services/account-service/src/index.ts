import { createApp } from './app.js';
import { KafkaConsumerAdapter } from './adapters/kafka-consumer.adapter.js';
import { KafkaProducerAdapter } from './adapters/kafka-producer.adapter.js';
import { PostgresAccountAdapter } from './adapters/postgres-account.adapter.js';
import { RedisIdempotencyAdapter } from './adapters/redis-idempotency.adapter.js';
import { FineractAdapterStub } from './adapters/fineract.adapter.js';
import { buildCustomerAccountCreationApplication } from './application/build-customer-account-creation.application.js';
import { buildAccountActivationApplication } from './application/build-account-activation.application.js';
import { buildAccountApplication } from './application/build-account.application.js';
import { AccountEventsPublisher } from './events/account.events.js';
import { AuditEventsService } from './events/audit.events.js';
import { bootstrapOpenTelemetry } from './observability/otel.js';

const SERVICE_NAME = 'account-service';
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';

async function start(): Promise<void> {
  bootstrapOpenTelemetry(SERVICE_NAME);

  const postgresAdapter = new PostgresAccountAdapter();
  const redisAdapter = new RedisIdempotencyAdapter();
  const fineractAdapter = new FineractAdapterStub();
  const kafkaProducer = new KafkaProducerAdapter();
  const kafkaConsumer = new KafkaConsumerAdapter();
  const accountEvents = new AccountEventsPublisher(kafkaProducer);
  const auditEvents = new AuditEventsService();

  const customerAccountCreation = buildCustomerAccountCreationApplication({
    postgresAdapter,
    kafkaConsumer,
    accountEvents,
    auditEvents,
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

  const accountActivation = buildAccountActivationApplication({
    postgresAdapter,
    redisAdapter,
    kafkaConsumer,
    accountEvents,
    auditEvents,
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

  await customerAccountCreation.consumer.subscribe();
  await accountActivation.consumer.subscribe();
  await customerAccountCreation.consumer.start();

  const accountApplication = buildAccountApplication({
    postgresAdapter,
    redisAdapter,
    fineractAdapter,
    kafkaProducer,
    accountEventsPublisher: accountEvents,
    auditEventsService: auditEvents
  });

  const app = createApp({
    accountApplication,
    accountActivationApplication: accountActivation.application
  });
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const host = process.env.HOST ?? DEFAULT_HOST;

  await app.listen({ port, host });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error: unknown) => {
    // Logging intentionally minimal and does not include sensitive request data.
    console.error('Failed to start account-service', error);
    process.exit(1);
  });
}
