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

import type { SuspenseApplication } from '../application/suspense.application.js';

const ResolveSuspenseSchema = z.object({
  entryId: z.string().trim().min(1)
});

export function buildSuspenseController(application: SuspenseApplication) {
  async function getSuspense(_request: FastifyRequest, reply: FastifyReply) {
    const entries = await application.listSuspense();
    return reply.send(buildSuccessResponse({ data: entries }));
  }

  async function postResolveSuspense(request: FastifyRequest, reply: FastifyReply) {
    const parsed = ResolveSuspenseSchema.safeParse(request.body);
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

    try {
      const resolved = await application.resolveSuspense({
        entryId: parsed.data.entryId,
        idempotencyKey,
        correlationId: getCorrelationId(request)
      });

      return reply.send(buildSuccessResponse({ data: resolved }));
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'suspense_not_found') {
        return reply.code(404).send(
          buildErrorResponse({
            error: buildNotFoundError('Suspense entry not found')
          })
        );
      }

      return reply.code(500).send(
        buildErrorResponse({
          error: {
            code: 'internal_error',
            message: 'Unexpected suspense resolution error',
            retriable: true
          }
        })
      );
    }
  }

  return { getSuspense, postResolveSuspense };
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
