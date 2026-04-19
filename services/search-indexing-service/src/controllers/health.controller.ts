import type { FastifyReply, FastifyRequest } from 'fastify';

export async function getHealth(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.code(200).send({
    status: 'ok',
    service: 'search-indexing-service'
  });
}
