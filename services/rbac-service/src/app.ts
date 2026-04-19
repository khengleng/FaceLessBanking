import Fastify, { type FastifyInstance } from 'fastify';
import { buildSuccessResponse } from '@faceless-banking/shared-types';

import { InMemoryRbacPostgresAdapter } from './adapters/postgres.adapter.js';
import { RbacApplication } from './application/rbac.application.js';
import { RbacMetrics } from './application/rbac.metrics.js';
import { buildRbacController } from './controllers/rbac.controller.js';
import { resolveCorrelationId } from './middleware/correlation-id.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.addHook('onRequest', async (request) => {
    request.correlationId = resolveCorrelationId(request);
  });

  const adapter = new InMemoryRbacPostgresAdapter();
  const metrics = new RbacMetrics();
  const application = new RbacApplication(adapter, app.log, metrics);
  const controller = buildRbacController(application);

  app.get('/health', async (request) =>
    buildSuccessResponse({
      data: { status: 'OK' },
      correlationId: request.correlationId
    })
  );

  app.post('/auth/roles', controller.postRoles);
  app.get('/auth/roles/:roleId', controller.getRoleById);
  app.post('/auth/permissions', controller.postPermissions);
  app.post('/auth/assign', controller.postAssign);
  app.get('/auth/users/:userId/roles', controller.getUserRoles);

  return app;
}
