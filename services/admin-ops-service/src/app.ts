import Fastify, { type FastifyInstance } from 'fastify';

import { OperationalDataAdapter } from './adapters/operational-data.adapter.js';
import { AdminOpsApplication } from './application/admin-ops.application.js';
import { buildAdminOpsController } from './controllers/admin-ops.controller.js';
import { AdminEventsAdapter } from './events/admin-events.adapter.js';
import { createInternalAuthGuard } from './middleware/internal-auth.guard.js';

const DEFAULT_ADMIN_TOKEN = 'dev-admin-token';

export function createApp(adminToken = process.env.ADMIN_OPS_TOKEN ?? DEFAULT_ADMIN_TOKEN): FastifyInstance {
  const app = Fastify({ logger: true });

  const operationalDataAdapter = new OperationalDataAdapter();
  const eventsAdapter = new AdminEventsAdapter();
  const application = new AdminOpsApplication(operationalDataAdapter, eventsAdapter);
  const controller = buildAdminOpsController(application);
  const authGuard = createInternalAuthGuard(adminToken);

  app.get('/health', async () => ({ status: 'OK' }));

  app.get('/admin/system-health', { preHandler: authGuard }, controller.getSystemHealth);
  app.get('/admin/services', { preHandler: authGuard }, controller.getServices);
  app.get('/admin/errors', { preHandler: authGuard }, controller.getErrors);

  return app;
}
