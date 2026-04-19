import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Customer360Application } from '../application/customer-360.application.js';

type GetCustomer360Request = FastifyRequest<{
  Params: {
    customerId: string;
  };
}>;

export function buildCustomer360Controller(application: Customer360Application) {
  async function getCustomer360(
    request: GetCustomer360Request,
    reply: FastifyReply
  ): Promise<void> {
    const result = await application.getCustomer360(request.params.customerId);

    if (result.kind === 'invalid') {
      reply.code(400).send({
        success: false,
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    reply.code(200).send({
      success: true,
      data: result.customer360
    });
  }

  return {
    getCustomer360
  };
}
