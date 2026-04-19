import Fastify, { type FastifyInstance } from 'fastify';

import {
  InMemoryAlertAdapter,
  InMemoryReconciliationStoreAdapter,
  InMemorySourceDataAdapter
} from './adapters/reconciliation.adapters.js';
import { ReconciliationApplication } from './application/reconciliation.application.js';
import { buildReconciliationController } from './controllers/reconciliation.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const sourceAdapter = new InMemorySourceDataAdapter();
  const storeAdapter = new InMemoryReconciliationStoreAdapter();
  const alertAdapter = new InMemoryAlertAdapter();

  const application = new ReconciliationApplication(sourceAdapter, storeAdapter, alertAdapter, app.log);
  const controller = buildReconciliationController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  app.get('/reconciliation/status', controller.getStatus);
  app.post('/reconciliation/run', controller.runReconciliation);

  return app;
}
