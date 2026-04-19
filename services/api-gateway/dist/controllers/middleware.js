import { randomUUID } from 'node:crypto';
const CORRELATION_ID_HEADER = 'x-correlation-id';
export async function correlationIdMiddleware(request, reply) {
    const headerValue = request.headers[CORRELATION_ID_HEADER];
    const correlationId = typeof headerValue === 'string' && headerValue.length > 0 ? headerValue : randomUUID();
    request.correlationId = correlationId;
    reply.header(CORRELATION_ID_HEADER, correlationId);
}
export async function authMiddleware(request, reply) {
    if (request.routerPath === '/health') {
        return;
    }
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.code(401).send({
            error: 'Unauthorized',
            reason: 'Missing bearer token. TODO: validate Keycloak token.'
        });
        return;
    }
    // TODO: Replace placeholder check with full Keycloak JWT validation.
}
