import type { FastifyReply, FastifyRequest } from 'fastify';

export type HealthResponse = {
  status: 'ok';
  service: 'rules-engine';
  timestamp: string;
};

export async function getHealth(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<HealthResponse> {
  reply.code(200);

  return {
    status: 'ok',
    service: 'rules-engine',
    timestamp: new Date().toISOString()
  };
}
