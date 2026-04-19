import Fastify, { type FastifyInstance } from 'fastify';

import { buildAuditApplication } from './application/build-audit.application.js';
import { buildAuditController } from './controllers/audit.controller.js';
import { getHealth } from './controllers/health.controller.js';
import {
  registerIdempotencyMiddleware,
  type IdempotencyMiddlewareOptions
} from './controllers/middleware/idempotency.middleware.js';
import {
  registerRateLimitMiddleware,
  type RateLimitMiddlewareOptions
} from './controllers/middleware/rate-limit.middleware.js';

export type AppOptions = {
  idempotency?: IdempotencyMiddlewareOptions;
  rateLimit?: RateLimitMiddlewareOptions;
};

export function createApp(options?: AppOptions): FastifyInstance {
  const app = Fastify({ logger: false });

  registerRateLimitMiddleware(app, options?.rateLimit);
  registerIdempotencyMiddleware(app, options?.idempotency);

  const auditApplication = buildAuditApplication();
  const auditController = buildAuditController(auditApplication);

  app.get('/health', getHealth);
  app.post('/audit/events', auditController.createAuditEvent);
  app.get('/audit/events/:eventId', auditController.getAuditEventById);
  app.get('/audit/events', auditController.queryAuditEvents);

  return app;
}
