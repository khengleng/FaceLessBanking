import Fastify from 'fastify';
import { PostgresReconciliationAdapter } from './adapters/postgres-reconciliation.adapter.js';
import { ReconciliationEventsPublisher } from './events/reconciliation-publisher.adapter.js';
import { ReconciliationApplication } from './application/reconciliation.application.js';
import { buildReconciliationController } from './controllers/reconciliation.controller.js';

type KafkaProducer = {
  send: (input: { topic: string; messages: Array<{ key: string; value: string }> }) => Promise<void>;
};

export function buildApp(params: {
  kafkaProducer: KafkaProducer;
}) {
  const app = Fastify({ logger: true });

  const postgresAdapter = new PostgresReconciliationAdapter();
  const eventPublisher = new ReconciliationEventsPublisher(params.kafkaProducer);
  
  const reconciliationApp = new ReconciliationApplication(
    postgresAdapter,
    eventPublisher,
    app.log
  );

  const controller = buildReconciliationController(reconciliationApp);

  app.get('/health', controller.health);
  app.post('/reconciliation/jobs', controller.createJob);
  app.get('/reconciliation/jobs/:jobId', controller.getJob);
  app.post('/reconciliation/jobs/:jobId/run', controller.runJob);

  return { app, reconciliationApp };
}
