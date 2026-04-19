import crypto from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildErrorResponse, buildSuccessResponse, buildValidationError } from '@faceless-banking/shared-types';

import type { ReconciliationApplication } from '../application/reconciliation.application.js';

export function buildReconciliationController(application: ReconciliationApplication) {
  async function getStatus(_request: FastifyRequest, reply: FastifyReply) {
    const status = await application.getStatus();
    return reply.send(buildSuccessResponse({ data: status }));
  }

  async function runReconciliation(request: FastifyRequest, reply: FastifyReply) {
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

    const result = await application.runReconciliation({
      idempotencyKey,
      correlationId: getCorrelationId(request)
    });

    return reply.send(buildSuccessResponse({ data: result }));
  }

  return { getStatus, runReconciliation };
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
