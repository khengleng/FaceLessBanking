import Fastify, { type FastifyInstance } from 'fastify';
import { TreasuryApplication } from './application/treasury.application.js';
import { PostgresTreasuryAdapter } from './adapters/postgres-treasury.adapter.js';
import { PaymentOrchestrationAdapterStub } from './adapters/payment-orchestration.adapter.js';
import { buildTreasuryController } from './controllers/treasury.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const postgresAdapter = new PostgresTreasuryAdapter();
  const paymentAdapter = new PaymentOrchestrationAdapterStub();
  const application = new TreasuryApplication(postgresAdapter, paymentAdapter, app.log);
  const controller = buildTreasuryController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  
  app.get('/treasury/accounts', controller.listAccounts);
  app.post('/treasury/accounts', controller.createAccount);
  app.post('/treasury/transfers', controller.initiateTransfer);

  return app;
}
