import { buildGatewayApplication, gatewayRoutes } from '../application/gateway.application.js';
const application = buildGatewayApplication();
export async function gatewayPlaceholderHandler(request, reply) {
    const { route } = request.params;
    if (!gatewayRoutes.includes(route)) {
        reply.code(404).send({ error: 'Route not found' });
        return;
    }
    const result = await application.routeRequest(route, request.correlationId);
    reply.code(result.statusCode).send(result);
}
