import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildErrorResponse, buildSuccessResponse, buildValidationError, type FieldErrorMap } from '@faceless-banking/shared-types';
import { z } from 'zod';

import type { IslamicBankingApplication } from '../application/islamic-banking.application.js';

const MurabahaSchema = z.object({
  assetCost: z.number().positive(),
  markup: z.number().nonnegative()
});

export function buildIslamicBankingController(application: IslamicBankingApplication) {
  async function postMurabahaCalculation(request: FastifyRequest, reply: FastifyReply) {
    const parsed = MurabahaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(validationErrorFromZod(parsed.error.flatten().fieldErrors));
    }

    const result = application.calculateMurabaha(parsed.data);
    return reply.send(buildSuccessResponse({ data: result }));
  }

  return {
    postMurabahaCalculation
  };
}

function validationErrorFromZod(fieldErrors: Record<string, string[] | undefined>) {
  const normalized: FieldErrorMap = {};

  for (const [field, errors] of Object.entries(fieldErrors)) {
    if (errors && errors.length > 0) {
      normalized[field] = errors;
    }
  }

  return buildErrorResponse({
    error: buildValidationError({
      message: 'Validation failed',
      fieldErrors: normalized
    })
  });
}
