import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { 
  buildErrorResponse, 
  buildSuccessResponse, 
  toCorrelationId 
} from '@faceless-banking/shared-types';
import type { DisputeApplication } from '../application/dispute.application.js';

const CreateDisputeSchema = z.object({
  entityType: z.enum(['payment', 'account', 'loan']),
  entityId: z.string().min(3),
  customerId: z.string().min(3),
  amount: z.number().positive(),
  currency: z.string().length(3),
  reason: z.string().min(5)
});

const ResolveDisputeSchema = z.object({
  resolution: z.enum(['RESOLVED', 'REJECTED'])
});

export function buildDisputeController(disputeApp: DisputeApplication) {
  async function createDispute(request: FastifyRequest, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id']
      ? toCorrelationId(request.headers['x-correlation-id'] as string)
      : undefined;

    const validation = CreateDisputeSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send(buildErrorResponse({
        correlationId,
        error: { code: 'validation_error', message: 'Invalid dispute data', details: validation.error.errors.map(e => e.message) }
      }));
    }

    const dispute = await disputeApp.createDispute({
      ...validation.data,
      correlationId
    });

    return reply.code(201).send(buildSuccessResponse({
      correlationId,
      data: dispute
    }));
  }

  async function getDispute(request: FastifyRequest<{ Params: { disputeId: string } }>, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id']
      ? toCorrelationId(request.headers['x-correlation-id'] as string)
      : undefined;

    const dispute = await disputeApp.getDispute(request.params.disputeId);
    if (!dispute) {
      return reply.code(404).send(buildErrorResponse({
        correlationId,
        error: { code: 'not_found', message: 'Dispute not found' }
      }));
    }

    return reply.send(buildSuccessResponse({
      correlationId,
      data: dispute
    }));
  }

  async function escalateDispute(request: FastifyRequest<{ Params: { disputeId: string } }>, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id']
      ? toCorrelationId(request.headers['x-correlation-id'] as string)
      : undefined;

    try {
      const dispute = await disputeApp.escalateDispute(request.params.disputeId, correlationId);
      return reply.send(buildSuccessResponse({
        correlationId,
        data: dispute
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid escalation request';
      return reply.code(400).send(buildErrorResponse({
        correlationId,
        error: { code: 'bad_request', message }
      }));
    }
  }

  async function resolveDispute(request: FastifyRequest<{ Params: { disputeId: string } }>, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id']
      ? toCorrelationId(request.headers['x-correlation-id'] as string)
      : undefined;

    const validation = ResolveDisputeSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send(buildErrorResponse({
        correlationId,
        error: { code: 'validation_error', message: 'Invalid resolution', details: validation.error.errors.map(e => e.message) }
      }));
    }

    try {
      const dispute = await disputeApp.resolveDispute(request.params.disputeId, validation.data.resolution, correlationId);
      return reply.send(buildSuccessResponse({
        correlationId,
        data: dispute
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid resolution request';
      return reply.code(400).send(buildErrorResponse({
        correlationId,
        error: { code: 'bad_request', message }
      }));
    }
  }

  return { createDispute, getDispute, escalateDispute, resolveDispute };
}
