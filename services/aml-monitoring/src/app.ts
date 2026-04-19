import Fastify, { type FastifyInstance } from 'fastify';

import { InMemoryAMLEventAdapter, InMemoryAMLStoreAdapter } from './adapters/aml.adapters.js';
import { AMLApplication } from './application/aml.application.js';
import { buildAMLController } from './controllers/aml.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const store = new InMemoryAMLStoreAdapter();
  const events = new InMemoryAMLEventAdapter();
  const application = new AMLApplication(store, events, app.log);
  const controller = buildAMLController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  app.get('/aml/alerts', controller.getAlerts);

  return app;
}
