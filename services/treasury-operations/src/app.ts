import Fastify from 'fastify';
import type { Producer } from 'kafkajs';
import { PostgresTreasuryAdapter } from './adapters/postgres-treasury.adapter.js';
import { PaymentOrchestrationAdapterStub } from './adapters/payment-orchestration.adapter.js';
import { TreasuryEventsPublisher } from './events/treasury-publisher.js';
import { TreasuryOperationsApplication } from './application/treasury-operations.application.js';
import { buildTreasuryOperationsController } from './controllers/treasury-operations.controller.js';

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

  const postgresAdapter = new PostgresTreasuryAdapter();
  const paymentAdapter = new PaymentOrchestrationAdapterStub();
  const publisher = new TreasuryEventsPublisher(params.producer);
  
  const application = new TreasuryOperationsApplication(
    postgresAdapter,
    paymentAdapter,
    publisher,
    app.log as unknown as AppLogger
  );

  const controller = buildTreasuryOperationsController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  
  app.get('/treasury/accounts', controller.listAccounts);
  app.get('/treasury/transfers/:transferId', controller.getTransfer);
  app.post('/treasury/transfer', controller.initiateTransfer);

  return { app, application };
}
