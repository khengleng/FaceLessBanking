import { randomUUID } from 'node:crypto';

import Fastify, { type FastifyInstance } from 'fastify';

import { KafkaAmlAdapter } from './adapters/kafka-aml.adapter.js';
import { PostgresAmlAdapter } from './adapters/postgres-aml.adapter.js';
import { AMLMonitoringApplication } from './application/aml-monitoring.application.js';
import { buildAmlMonitoringController } from './controllers/aml-monitoring.controller.js';
import { AMLEventsConsumer } from './events/aml-events.consumer.js';
import { AMLMetrics } from './events/metrics.js';

type AppDeps = {
  postgresAdapter?: PostgresAmlAdapter;
  kafkaAdapter?: KafkaAmlAdapter;
  metrics?: AMLMetrics;
};

export function createApp(deps?: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info'
    }
  });

  const postgresAdapter = deps?.postgresAdapter ?? new PostgresAmlAdapter();
  const kafkaAdapter = deps?.kafkaAdapter ?? new KafkaAmlAdapter();
  const metrics = deps?.metrics ?? new AMLMetrics();

  const application = new AMLMonitoringApplication(
    postgresAdapter,
    kafkaAdapter,
    metrics,
    app.log
  );
  const controller = buildAmlMonitoringController(application);
  const consumer = new AMLEventsConsumer(kafkaAdapter, application);
  void consumer.subscribe();

  app.addHook('onRequest', async (request, reply) => {
    const existing = request.headers['x-correlation-id'];
    const correlationId = Array.isArray(existing)
      ? (existing[0] ?? randomUUID())
      : (typeof existing === 'string' && existing.length > 0 ? existing : randomUUID());

    request.headers['x-correlation-id'] = correlationId;
    reply.header('x-correlation-id', correlationId);

    request.log.info(
      {
        correlationId,
        method: request.method,
        path: request.url
      },
      'Incoming request'
    );
  });

  app.get('/health', async () => ({ status: 'OK' }));
  app.get('/aml/alerts', controller.listAlerts);
  app.get('/aml/alerts/:alertId', controller.getAlertById);

  return app;
}
