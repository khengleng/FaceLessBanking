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

import type { TradeFinanceApplication } from '../application/trade-finance.application.js';

const CreateLCSchema = z.object({
  applicant: z.string().trim().min(1),
  beneficiary: z.string().trim().min(1),
  amount: z.number().positive(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase())
});

const LcIdParamsSchema = z.object({
  lcId: z.string().trim().min(1)
});

export function buildTradeFinanceController(application: TradeFinanceApplication) {
  async function postLC(request: FastifyRequest, reply: FastifyReply) {
    const parsed = CreateLCSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(validationErrorFromZod(parsed.error.flatten().fieldErrors));
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

    const lc = await application.createLC({
      request: parsed.data,
      idempotencyKey,
      correlationId: getCorrelationId(request)
    });

    return reply.send(buildSuccessResponse({ data: lc }));
  }

  async function getLC(request: FastifyRequest<{ Params: { lcId: string } }>, reply: FastifyReply) {
    const parsed = LcIdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send(validationErrorFromZod(parsed.error.flatten().fieldErrors));
    }

    const lc = await application.getLC(parsed.data.lcId);
    if (!lc) {
      return reply.code(404).send(
        buildErrorResponse({
          error: buildNotFoundError('Letter of credit not found')
        })
      );
    }

    return reply.send(buildSuccessResponse({ data: lc }));
  }

  async function approveLC(request: FastifyRequest<{ Params: { lcId: string } }>, reply: FastifyReply) {
    const params = LcIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send(validationErrorFromZod(params.error.flatten().fieldErrors));
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

    try {
      const lc = await application.approveLC({
        lcId: params.data.lcId,
        idempotencyKey,
        correlationId: getCorrelationId(request)
      });

      return reply.send(buildSuccessResponse({ data: lc }));
    } catch (error: unknown) {
      return mapDomainError(error, reply);
    }
  }

  async function issueLC(request: FastifyRequest<{ Params: { lcId: string } }>, reply: FastifyReply) {
    const params = LcIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send(validationErrorFromZod(params.error.flatten().fieldErrors));
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

    try {
      const lc = await application.issueLC({
        lcId: params.data.lcId,
        idempotencyKey,
        correlationId: getCorrelationId(request)
      });

      return reply.send(buildSuccessResponse({ data: lc }));
    } catch (error: unknown) {
      return mapDomainError(error, reply);
    }
  }

  async function settleLC(request: FastifyRequest<{ Params: { lcId: string } }>, reply: FastifyReply) {
    const params = LcIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send(validationErrorFromZod(params.error.flatten().fieldErrors));
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

    try {
      const lc = await application.settleLC({
        lcId: params.data.lcId,
        idempotencyKey,
        correlationId: getCorrelationId(request)
      });

      return reply.send(buildSuccessResponse({ data: lc }));
    } catch (error: unknown) {
      return mapDomainError(error, reply);
    }
  }

  return {
    postLC,
    getLC,
    approveLC,
    issueLC,
    settleLC
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

function mapDomainError(error: unknown, reply: FastifyReply) {
  if (error instanceof Error && error.message === 'lc_not_found') {
    return reply.code(404).send(
      buildErrorResponse({
        error: buildNotFoundError('Letter of credit not found')
      })
    );
  }

  if (error instanceof Error && error.message === 'invalid_transition') {
    return reply.code(409).send(
      buildErrorResponse({
        error: {
          code: 'conflict',
          message: 'Invalid LC status transition',
          retriable: false
        }
      })
    );
  }

  if (error instanceof Error && error.message === 'workflow_approval_required') {
    return reply.code(409).send(
      buildErrorResponse({
        error: {
          code: 'conflict',
          message: 'Approval requires workflow confirmation',
          retriable: false
        }
      })
    );
  }

  return reply.code(500).send(
    buildErrorResponse({
      error: {
        code: 'internal_error',
        message: 'Unexpected trade finance error',
        retriable: true
      }
    })
  );
}
