import type { FastifyReply, FastifyRequest } from 'fastify';

export type HealthResponse = {
  status: 'ok';
  service: 'audit-service';
  timestamp: string;
};

export async function getHealth(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<HealthResponse> {
  reply.code(200);

  return {
    status: 'ok',
    service: 'audit-service',
    timestamp: new Date().toISOString()
  };
}
