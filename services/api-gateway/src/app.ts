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

  // Auth session management
  app.get('/auth/session', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'unauthorized', message: 'No active session' });
    }
    return reply.send({
      principalId: request.user.id,
      displayName: request.user.email || request.user.id,
      roles: request.user.roles,
      expiresAt: new Date(Date.now() + 3600000).toISOString() // Mock expiry from middleware logic
    });
  });

  app.post('/auth/logout', async (_request, reply) => {
    // In JWT architecture, client kills the token. Gateway just acknowledges.
    return reply.send({ status: 'logged_out' });
  });

  app.all<{ Params: { route: string } }>('/:route', gatewayPlaceholderHandler);
  app.all<{ Params: { route: string } }>('/:route/*', gatewayPlaceholderHandler);


  return app;
}
