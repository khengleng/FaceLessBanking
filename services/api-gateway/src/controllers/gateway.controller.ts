import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  buildGatewayApplication,
  isGatewayRoute
} from '../application/gateway.application.js';

const application = buildGatewayApplication();

export async function gatewayPlaceholderHandler(
  request: FastifyRequest<{ Params: { route: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { route } = request.params;

  if (!isGatewayRoute(route)) {
    reply.code(404).send({
      error: 'route_not_found',
      details: ['Requested route placeholder is not configured']
    });
    return;
  }

  const rawUrl = request.raw.url ?? `/${route}`;
  const queryIndex = rawUrl.indexOf('?');
  const path = queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex);
  const queryString = queryIndex === -1 ? undefined : rawUrl.slice(queryIndex + 1);
  const contentTypeHeader = request.headers['content-type'];
  const acceptHeader = request.headers.accept;

  const result = await application.routeRequest({
    route,
    method: request.method,
    path,
    queryString,
    body: request.body,
    correlationId: request.correlationId,
    headers: {
      authorization: request.headers.authorization,
      contentType: typeof contentTypeHeader === 'string' ? contentTypeHeader : undefined,
      accept: typeof acceptHeader === 'string' ? acceptHeader : undefined
    }
  });
  reply.code(result.statusCode).send(result);
}
