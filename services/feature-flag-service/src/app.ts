import Fastify, { type FastifyInstance } from 'fastify';

import { FeatureFlagStoreAdapter } from './adapters/feature-flag-store.adapter.js';
import { FeatureFlagApplication } from './application/feature-flag.application.js';
import { buildFeatureFlagController } from './controllers/feature-flag.controller.js';
import { FeatureFlagEventsAdapter } from './events/feature-flag-events.adapter.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const store = new FeatureFlagStoreAdapter();
  const events = new FeatureFlagEventsAdapter();
  const application = new FeatureFlagApplication(store, events);
  const controller = buildFeatureFlagController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  app.get('/feature-flags', controller.listFlags);
  app.get('/feature-flags/:flagKey', controller.getFlagByKey);
  app.post('/feature-flags', controller.postFlag);

  return app;
}
