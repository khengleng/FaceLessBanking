import Fastify, { type FastifyInstance } from 'fastify';

import { InMemoryRbacStoreAdapter } from './adapters/rbac.adapters.js';
import { RbacApplication } from './application/rbac.application.js';
import { buildRbacController } from './controllers/rbac.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const store = new InMemoryRbacStoreAdapter();
  const application = new RbacApplication(store, app.log);
  const controller = buildRbacController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  app.post('/auth/roles', controller.postRoles);
  app.post('/auth/assign', controller.postAssign);

  return app;
}
