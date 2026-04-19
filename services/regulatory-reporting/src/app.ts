import Fastify, { type FastifyInstance } from 'fastify';

import {
  InMemoryReportDataAdapter,
  InMemoryReportStoreAdapter
} from './adapters/regulatory-reporting.adapters.js';
import { RegulatoryReportingApplication } from './application/regulatory-reporting.application.js';
import { buildRegulatoryReportingController } from './controllers/regulatory-reporting.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const dataAdapter = new InMemoryReportDataAdapter();
  const storeAdapter = new InMemoryReportStoreAdapter();
  const application = new RegulatoryReportingApplication(dataAdapter, storeAdapter, app.log);
  const controller = buildRegulatoryReportingController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  app.get('/regulatory/reports', controller.getReports);
  app.post('/regulatory/generate', controller.postGenerate);

  return app;
}
