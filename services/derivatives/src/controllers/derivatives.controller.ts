import crypto from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildErrorResponse,
  buildNotFoundError,
  buildSuccessResponse,
  buildValidationError,
  type FieldErrorMap
} from '@faceless-banking/shared-types';
import { z } from 'zod';

import type { DerivativesApplication } from '../application/derivatives.application.js';

const CreateFXForwardSchema = z.object({
  baseCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  quoteCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  notional: z.number().positive(),
  forwardRate: z.number().positive(),
  maturityDate: z.string().datetime()
});

const ContractIdParamsSchema = z.object({
  id: z.string().trim().min(1)
});

export function buildDerivativesController(application: DerivativesApplication) {
  async function postFxForward(request: FastifyRequest, reply: FastifyReply) {
    const parsed = CreateFXForwardSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(validationErrorFromZod(parsed.error.flatten().fieldErrors));
    }

    if (parsed.data.baseCurrency === parsed.data.quoteCurrency) {
      return reply.code(400).send(
        buildErrorResponse({
          error: buildValidationError({ message: 'baseCurrency and quoteCurrency must be different' })
        })
      );
    }

    const idempotencyKey = getRequiredIdempotencyKey(request);
    if (!idempotencyKey) {
      return reply.code(400).send(
        buildErrorResponse({
          error: buildValidationError({
            message: 'Missing required x-idempotency-key header',
            fieldErrors: { 'x-idempotency-key': ['Header is required for write operations'] }
          })
        })
      );
    }

    const contract = await application.createFXForward({
      request: parsed.data,
      idempotencyKey,
      correlationId: getCorrelationId(request)
    });

    return reply.send(buildSuccessResponse({ data: contract }));
  }

  async function getContract(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = ContractIdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send(validationErrorFromZod(parsed.error.flatten().fieldErrors));
    }

    const contract = await application.getFXForwardById(parsed.data.id);
    if (!contract) {
      return reply.code(404).send(
        buildErrorResponse({
          error: buildNotFoundError('FX forward contract not found')
        })
      );
    }

    return reply.send(buildSuccessResponse({ data: contract }));
  }

  return {
    postFxForward,
    getContract
  };
}

function getRequiredIdempotencyKey(request: FastifyRequest): string | null {
  const raw = request.headers['x-idempotency-key'];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }

  return null;
}

function getCorrelationId(request: FastifyRequest): string {
  const raw = request.headers['x-correlation-id'];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }

  return crypto.randomUUID();
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
