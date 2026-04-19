import type { FastifyReply, FastifyRequest } from 'fastify';
import { 
  buildErrorResponse, 
  buildSuccessResponse, 
  toCorrelationId 
} from '@faceless-banking/shared-types';
import type { FeeEngineApplication } from '../application/fee-engine.application.js';
import { z } from 'zod';

const FeeRuleSchema = z.object({
  ruleId: z.string().uuid(),
  ruleType: z.enum(['FIXED', 'PERCENTAGE']),
  triggerEventType: z.string(),
  fixedAmountCents: z.number().optional(),
  percentage: z.number().optional(),
  currency: z.string().length(3),
  status: z.enum(['ACTIVE', 'INACTIVE'])
});

export function buildFeeController(feeApplication: FeeEngineApplication) {
  async function health(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ status: 'OK' });
  }

  async function createRule(request: FastifyRequest, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id'] 
      ? toCorrelationId(request.headers['x-correlation-id'] as string) 
      : undefined;

    const validation = FeeRuleSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send(buildErrorResponse({
        correlationId,
        error: { code: 'validation_error', message: 'Invalid rule data', details: validation.error.errors.map(e => e.message) }
      }));
    }

    await feeApplication.createFeeRule(validation.data);
    return reply.code(201).send(buildSuccessResponse({ correlationId, data: validation.data }));
  }

  async function getRule(request: FastifyRequest<{ Params: { ruleId: string } }>, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id'] 
      ? toCorrelationId(request.headers['x-correlation-id'] as string) 
      : undefined;

    const rule = await feeApplication.getFeeRule(request.params.ruleId);
    if (!rule) {
      return reply.code(404).send(buildErrorResponse({ correlationId, error: { code: 'not_found', message: 'Rule not found' } }));
    }

    return reply.send(buildSuccessResponse({ correlationId, data: rule }));
  }

  async function evaluateManual(request: FastifyRequest, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id'] 
      ? toCorrelationId(request.headers['x-correlation-id'] as string) 
      : undefined;

    const result = await feeApplication.evaluateEvent(request.body);
    return reply.send(buildSuccessResponse({ correlationId, data: result }));
  }

  return { health, createRule, getRule, evaluateManual };
}
