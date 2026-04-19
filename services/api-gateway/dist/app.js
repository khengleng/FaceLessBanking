import Fastify from 'fastify';
import { getHealth } from './controllers/health.controller.js';
import { gatewayPlaceholderHandler } from './controllers/gateway.controller.js';
import { authMiddleware, correlationIdMiddleware } from './controllers/middleware.js';
export function createApp() {
    const app = Fastify({ logger: false });
    app.decorateRequest('correlationId', '');
    app.addHook('onRequest', correlationIdMiddleware);
    app.addHook('onRequest', authMiddleware);
    app.get('/health', getHealth);
    app.all('/:route', gatewayPlaceholderHandler);
    app.all('/:route/*', gatewayPlaceholderHandler);
    return app;
}
