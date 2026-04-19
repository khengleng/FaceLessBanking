import Fastify, { type FastifyInstance } from 'fastify';

import { Customer360SourcesAdapter } from './adapters/customer-360-sources.adapter.js';
import { Customer360Application } from './application/customer-360.application.js';
import { buildCustomer360Controller } from './controllers/customer-360.controller.js';
import { Customer360EventsAdapter } from './events/customer-360-events.adapter.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const sourcesAdapter = new Customer360SourcesAdapter();
  const eventsAdapter = new Customer360EventsAdapter();
  const application = new Customer360Application(sourcesAdapter, eventsAdapter);
  const controller = buildCustomer360Controller(application);

  app.get('/health', async () => ({ status: 'OK' }));
  app.get('/customer-360/:customerId', controller.getCustomer360);

  return app;
}
