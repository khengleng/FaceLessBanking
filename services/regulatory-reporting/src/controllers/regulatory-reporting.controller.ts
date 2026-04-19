import crypto from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildErrorResponse,
  buildSuccessResponse,
  buildValidationError,
  type FieldErrorMap
} from '@faceless-banking/shared-types';
import { z } from 'zod';

import type { RegulatoryReportingApplication } from '../application/regulatory-reporting.application.js';

const GenerateReportSchema = z.object({
  type: z.enum(['TRANSACTION', 'AML', 'CAPITAL'])
});

export function buildRegulatoryReportingController(application: RegulatoryReportingApplication) {
  async function getReports(_request: FastifyRequest, reply: FastifyReply) {
    const reports = await application.listReports();
    return reply.send(buildSuccessResponse({ data: reports }));
  }

  async function postGenerate(request: FastifyRequest, reply: FastifyReply) {
    const parsed = GenerateReportSchema.safeParse(request.body);
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

    const report = await application.generateReport({
      type: parsed.data.type,
      idempotencyKey,
      correlationId: getCorrelationId(request)
    });

    return reply.send(buildSuccessResponse({ data: report }));
  }

  return { getReports, postGenerate };
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
