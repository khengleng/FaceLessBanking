import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AdminApplication } from '../application/admin.application.js';

export function buildAdminController(application: AdminApplication) {
  async function getSystemHealth(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const health = await application.getSystemHealth();

    reply.code(200).send({
      success: true,
      data: health
    });
  }

  async function getServices(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const services = await application.getServices();

    reply.code(200).send({
      success: true,
      data: {
        items: services
      }
    });
  }

  async function getErrors(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const errors = await application.getErrors();

    reply.code(200).send({
      success: true,
      data: errors
    });
  }

  return {
    getSystemHealth,
    getServices,
    getErrors
  };
}

