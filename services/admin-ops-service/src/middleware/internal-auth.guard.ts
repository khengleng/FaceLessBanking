import type { FastifyReply, FastifyRequest } from 'fastify';

export function createInternalAuthGuard(expectedToken: string) {
  return async function internalAuthGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const incoming = request.headers['x-internal-admin-token'];
    const token = Array.isArray(incoming) ? incoming[0] : incoming;

    if (!token || token !== expectedToken) {
      reply.code(401).send({
        success: false,
        error: 'unauthorized'
      });
      return;
    }
  };
}
