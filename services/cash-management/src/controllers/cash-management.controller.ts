import crypto from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildErrorResponse,
  buildSuccessResponse,
  buildValidationError,
  type FieldErrorMap
} from '@faceless-banking/shared-types';
import { z } from 'zod';

import type { CashManagementApplication } from '../application/cash-management.application.js';

const CreateVirtualAccountSchema = z.object({
  corporateId: z.string().trim().min(1),
  mappedAccountId: z.string().trim().min(1),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase())
});

const CreateBulkPaymentsSchema = z.object({
  corporateId: z.string().trim().min(1),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  items: z.array(z.object({
    sourceAccountId: z.string().trim().min(1),
    destinationAccountId: z.string().trim().min(1),
    amount: z.number().positive()
  })).min(1)
});

const PositionsQuerySchema = z.object({
  corporateId: z.string().trim().min(1).optional()
});

export function buildCashManagementController(application: CashManagementApplication) {
  async function postVirtualAccounts(request: FastifyRequest, reply: FastifyReply) {
    const parsed = CreateVirtualAccountSchema.safeParse(request.body);
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

    const virtualAccount = await application.createVirtualAccount({
      request: parsed.data,
      idempotencyKey,
      correlationId: getCorrelationId(request)
    });

    return reply.send(buildSuccessResponse({ data: virtualAccount }));
  }

  async function postBulkPayments(request: FastifyRequest, reply: FastifyReply) {
    const parsed = CreateBulkPaymentsSchema.safeParse(request.body);
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

    const batch = await application.processBulkPayments({
      request: parsed.data,
      idempotencyKey,
      correlationId: getCorrelationId(request)
    });

    return reply.send(buildSuccessResponse({ data: batch }));
  }

  async function getPositions(
    request: FastifyRequest<{ Querystring: { corporateId?: string } }>,
    reply: FastifyReply
  ) {
    const parsed = PositionsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(validationErrorFromZod(parsed.error.flatten().fieldErrors));
    }

    const positions = await application.getPositions(parsed.data.corporateId);
    return reply.send(buildSuccessResponse({ data: positions }));
  }

  return {
    postVirtualAccounts,
    postBulkPayments,
    getPositions
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
