import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import { InMemoryConfigStoreAdapter } from './adapters/config-store.adapter.js';
import { InMemoryErrorLogAdapter } from './adapters/error-log.adapter.js';
import { AdminApplication } from './application/admin.application.js';
import { ConfigApplication } from './application/config.application.js';
import { buildAdminController } from './controllers/admin.controller.js';
import { buildConfigController } from './controllers/config.controller.js';
import { ConfigEventsAdapter } from './events/config-events.adapter.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const storeAdapter = new InMemoryConfigStoreAdapter();
  const errorLogAdapter = new InMemoryErrorLogAdapter();
  const eventsAdapter = new ConfigEventsAdapter();
  const application = new ConfigApplication(storeAdapter, eventsAdapter);
  const adminApplication = new AdminApplication(errorLogAdapter);
  const controller = buildConfigController(application);
  const adminController = buildAdminController(adminApplication);

  app.setErrorHandler((error, request, reply) => {
    const message = error instanceof Error ? error.message : 'unknown_error';

    void errorLogAdapter.addError({
      errorId: randomUUID(),
      message,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString()
    });

    reply.code(500).send({
      success: false,
      error: 'internal_error'
    });
  });

  app.get('/health', async () => ({ status: 'OK' }));
  app.get('/config', controller.getConfig);
  app.get('/config/:key', controller.getConfigByKey);
  app.post('/config', controller.postConfig);
  app.get('/features/:flagKey', controller.getFeatureFlag);
  app.post('/features/:flagKey', controller.postFeatureFlag);
  app.get('/admin/system-health', adminController.getSystemHealth);
  app.get('/admin/services', adminController.getServices);
  app.get('/admin/errors', adminController.getErrors);

  return app;
}
