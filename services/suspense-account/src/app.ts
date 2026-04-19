import Fastify, { type FastifyInstance } from 'fastify';

import { InMemorySuspenseStoreAdapter } from './adapters/suspense.adapters.js';
import { SuspenseApplication } from './application/suspense.application.js';
import { buildSuspenseController } from './controllers/suspense.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const store = new InMemorySuspenseStoreAdapter();
  const application = new SuspenseApplication(store, app.log);
  const controller = buildSuspenseController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  app.get('/suspense', controller.getSuspense);
  app.post('/suspense/resolve', controller.postResolveSuspense);

  return app;
}
