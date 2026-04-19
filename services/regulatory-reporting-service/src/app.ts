import { randomUUID } from 'node:crypto';

import Fastify, { type FastifyInstance } from 'fastify';

import { KafkaRegulatoryAdapter } from './adapters/kafka-regulatory.adapter.js';
import { PostgresRegulatoryAdapter } from './adapters/postgres-regulatory.adapter.js';
import { SourceDataAdapter } from './adapters/source-data.adapter.js';
import { RegulatoryReportingApplication } from './application/regulatory-reporting.application.js';
import { buildRegulatoryReportingController } from './controllers/regulatory-reporting.controller.js';
import { RegulatoryReportingMetrics } from './events/metrics.js';

type AppDeps = {
  postgresAdapter?: PostgresRegulatoryAdapter;
  sourceDataAdapter?: SourceDataAdapter;
  kafkaAdapter?: KafkaRegulatoryAdapter;
  metrics?: RegulatoryReportingMetrics;
};

export function createApp(deps?: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info'
    }
  });

  const postgresAdapter = deps?.postgresAdapter ?? new PostgresRegulatoryAdapter();
  const sourceDataAdapter = deps?.sourceDataAdapter ?? new SourceDataAdapter();
  const kafkaAdapter = deps?.kafkaAdapter ?? new KafkaRegulatoryAdapter();
  const metrics = deps?.metrics ?? new RegulatoryReportingMetrics();

  const application = new RegulatoryReportingApplication(
    postgresAdapter,
    sourceDataAdapter,
    kafkaAdapter,
    metrics,
    app.log
  );
  const controller = buildRegulatoryReportingController(application);

  app.addHook('onRequest', async (request, reply) => {
    const existing = request.headers['x-correlation-id'];
    const correlationId = Array.isArray(existing)
      ? (existing[0] ?? randomUUID())
      : (typeof existing === 'string' && existing.length > 0 ? existing : randomUUID());

    request.headers['x-correlation-id'] = correlationId;
    reply.header('x-correlation-id', correlationId);

    request.log.info({
      correlationId,
      method: request.method,
      path: request.url
    }, 'Incoming request');
  });

  app.get('/health', async () => ({ status: 'OK' }));
  app.get('/regulatory/reports', controller.getReports);
  app.get('/regulatory/reports/:reportId', controller.getReportById);
  app.post('/regulatory/generate', controller.postGenerate);

  return app;
}
