import fastify from 'fastify';
import type { Producer } from 'kafkajs';
import { PostgresFeeAdapter } from './adapters/postgres-fee.adapter.js';
import { FeeEventsPublisher } from './events/fee-publisher.adapter.js';
import { FeeEngineApplication } from './application/fee-engine.application.js';
import { FeeCollectionApplication } from './application/fee-collection.application.js';
import { PaymentOrchestrationAdapterStub } from './adapters/payment-orchestration.adapter.js';
import { buildFeeController } from './controllers/fee.controller.js';

type AppLogger = {
  info: (payload: Record<string, unknown>, message: string) => void;
  warn: (payload: Record<string, unknown>, message: string) => void;
  error: (payload: Record<string, unknown>, message: string) => void;
};

export function buildApp(params: {
  kafkaProducer: Producer;
  logger?: boolean;
}) {
  const app = fastify({ logger: params.logger ?? true });

  const postgresAdapter = new PostgresFeeAdapter();
  const eventsPublisher = new FeeEventsPublisher(params.kafkaProducer);
  
  const feeApplication = new FeeEngineApplication(
    postgresAdapter,
    eventsPublisher,
    app.log as unknown as AppLogger
  );

  const collectionApplication = new FeeCollectionApplication(
    postgresAdapter,
    eventsPublisher,
    new PaymentOrchestrationAdapterStub(),
    'GL-FEE-INCOME-TEST',
    app.log as unknown as AppLogger
  );

  const controller = buildFeeController(feeApplication);

  app.get('/health', controller.health);
  app.post('/fees/rules', controller.createRule);
  app.get('/fees/rules/:ruleId', controller.getRule);
  app.post('/fees/evaluate', controller.evaluateManual);

  return { app, feeApplication, collectionApplication };
}
