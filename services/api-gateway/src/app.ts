import Fastify, { type FastifyInstance } from 'fastify';
import fastifyPrometheus from '@fastify/prometheus';


import { getHealth } from './controllers/health.controller.js';
import { gatewayPlaceholderHandler } from './controllers/gateway.controller.js';
import {
  authMiddleware,
  correlationIdMiddleware,
  createRateLimitMiddleware,
  type RateLimitMiddlewareOptions
} from './controllers/middleware.js';

export type AppOptions = {
  rateLimit?: RateLimitMiddlewareOptions;
};

export function createApp(options?: AppOptions): FastifyInstance {
  const app = Fastify({ logger: true });

  await app.register(fastifyPrometheus, {
    endpoint: '/metrics',
  });

  app.decorateRequest('correlationId', '');

  app.addHook('onRequest', correlationIdMiddleware);
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', createRateLimitMiddleware(options?.rateLimit));

  app.get('/health', getHealth);

  app.all<{ Params: { route: string } }>('/:route', gatewayPlaceholderHandler);
  app.all<{ Params: { route: string } }>('/:route/*', gatewayPlaceholderHandler);

  return app;
}
