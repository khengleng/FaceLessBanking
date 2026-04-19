import Fastify, { type FastifyInstance } from 'fastify';

import { InMemoryCashManagementEventAdapter, InMemoryCashManagementPostgresAdapter } from './adapters/cash-management.adapters.js';
import { CashManagementApplication } from './application/cash-management.application.js';
import { buildCashManagementController } from './controllers/cash-management.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const postgres = new InMemoryCashManagementPostgresAdapter();
  const events = new InMemoryCashManagementEventAdapter();
  const application = new CashManagementApplication(postgres, events, app.log);
  const controller = buildCashManagementController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  app.post('/cash/virtual-accounts', controller.postVirtualAccounts);
  app.post('/cash/bulk-payments', controller.postBulkPayments);
  app.get('/cash/positions', controller.getPositions);

  return app;
}
