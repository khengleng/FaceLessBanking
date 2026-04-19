import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse, buildValidationError } from '@faceless-banking/shared-types';

import type { CapitalApplication } from '../application/capital.application.js';

const QuerySchema = z.object({
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional()
});

export function buildCapitalController(application: CapitalApplication) {
  async function getRwa(
    request: FastifyRequest<{ Querystring: { currency?: string } }>,
    reply: FastifyReply
  ) {
    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(
        buildErrorResponse({
          error: buildValidationError({ message: 'Invalid RWA query' })
        })
      );
    }

    const result = await application.getRWA(parsed.data.currency ?? 'USD');
    return reply.send(buildSuccessResponse({ data: result }));
  }

  async function getCar(
    request: FastifyRequest<{ Querystring: { currency?: string } }>,
    reply: FastifyReply
  ) {
    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(
        buildErrorResponse({
          error: buildValidationError({ message: 'Invalid CAR query' })
        })
      );
    }

    const result = await application.getCAR(parsed.data.currency ?? 'USD');
    return reply.send(buildSuccessResponse({ data: result }));
  }

  return { getRwa, getCar };
}
