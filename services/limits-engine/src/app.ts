import Fastify from 'fastify';
import type { Producer } from 'kafkajs';
import { PostgresLimitsAdapter } from './adapters/postgres-limits.adapter.js';
import { WorkflowAdapterStub } from './adapters/workflow.adapter.js';
import { LimitsEventsPublisher } from './events/limits-publisher.js';
import { LimitsApplication } from './application/limits.application.js';
import { buildLimitsController } from './controllers/limits.controller.js';

type AppLogger = {
  info: (payload: Record<string, unknown>, message: string) => void;
  warn: (payload: Record<string, unknown>, message: string) => void;
  error: (payload: Record<string, unknown>, message: string) => void;
};

export function buildApp(params: {
  producer: Producer;
  logger?: boolean;
}) {
  const app = Fastify({ logger: params.logger ?? true });

  const postgresAdapter = new PostgresLimitsAdapter();
  const workflowAdapter = new WorkflowAdapterStub();
  const eventPublisher = new LimitsEventsPublisher(params.producer);
  
  const application = new LimitsApplication(
    postgresAdapter,
    workflowAdapter,
    eventPublisher,
    app.log as unknown as AppLogger
  );

  const controller = buildLimitsController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  
  app.post('/limits/evaluate', controller.evaluate);
  app.post('/limits/rules', controller.createRule);
  app.get('/limits/rules/:ruleId', controller.getRule);

  return { app, application };
}
