import { createApp } from './app.js';
import { bootstrapOpenTelemetry } from './observability/otel.js';
import { buildPaymentProcessor } from './application/build-payment-processor.application.js';
import { PostgresPaymentAdapter } from './adapters/postgres-payment.adapter.js';
import { KafkaConsumerAdapter } from './adapters/kafka-consumer.adapter.js';
import { KafkaProducerAdapter } from './adapters/kafka-producer.adapter.js';
import { AuditEventsService } from './events/audit.events.js';
import { PaymentEventsPublisher } from './events/payment.events.js';
import { PaymentMetrics } from './events/metrics.js';

const SERVICE_NAME = 'payment-orchestration';
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';

async function start(): Promise<void> {
  bootstrapOpenTelemetry(SERVICE_NAME);

  const postgresAdapter = new PostgresPaymentAdapter();
  const kafkaConsumer = new KafkaConsumerAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const auditEvents = new AuditEventsService();
  const paymentEvents = new PaymentEventsPublisher(kafkaProducer);
  const metrics = new PaymentMetrics();

  const app = createApp({
    postgresAdapter,
    kafkaProducer
  });

  const { consumer } = buildPaymentProcessor({
    postgresAdapter,
    kafkaConsumer,
    auditEvents,
    paymentEvents,
    metrics
  });

  await consumer.start();

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const host = process.env.HOST ?? DEFAULT_HOST;

  await app.listen({ port, host });
}


if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error: unknown) => {
    // Logging intentionally minimal and does not include sensitive request data.
    console.error('Failed to start payment-orchestration', error);
    process.exit(1);
  });
}
