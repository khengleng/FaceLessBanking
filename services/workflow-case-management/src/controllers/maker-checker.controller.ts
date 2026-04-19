import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { 
  buildErrorResponse, 
  buildSuccessResponse, 
  toCorrelationId 
} from '@faceless-banking/shared-types';
import type { MakerCheckerApplication } from '../application/maker-checker.application.js';

const MakerCheckerActionTypeSchema = z.enum([
  'MANUAL_ACCOUNT_ACTIVATION',
  'LOAN_APPROVAL',
  'MANUAL_PAYMENT_RELEASE',
  'MANUAL_FEE_WAIVER'
]);

const EvaluateActionSchema = z.object({
  actionType: MakerCheckerActionTypeSchema,
  amount: z.number().optional(),
  referenceId: z.string().min(3)
});

const CreatePolicySchema = z.object({
  actionType: MakerCheckerActionTypeSchema,
  enabled: z.boolean().optional(),
  thresholdAmount: z.number().optional(),
  caseType: z.string().min(3)
});

export function buildMakerCheckerController(makerCheckerApp: MakerCheckerApplication) {
  async function health(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ status: 'OK' });
  }

  async function evaluateAction(request: FastifyRequest, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id']
      ? toCorrelationId(request.headers['x-correlation-id'] as string)
      : undefined;

    const validation = EvaluateActionSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send(buildErrorResponse({
        correlationId,
        error: { code: 'validation_error', message: 'Invalid evaluation request', details: validation.error.errors.map(e => e.message) }
      }));
    }

    const decision = await makerCheckerApp.evaluateAction({
      ...validation.data,
      correlationId
    });

    return reply.send(buildSuccessResponse({
      correlationId,
      data: decision
    }));
  }

  async function createPolicy(request: FastifyRequest, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id']
      ? toCorrelationId(request.headers['x-correlation-id'] as string)
      : undefined;

    const validation = CreatePolicySchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send(buildErrorResponse({
        correlationId,
        error: { code: 'validation_error', message: 'Invalid policy data', details: validation.error.errors.map(e => e.message) }
      }));
    }

    const policy = await makerCheckerApp.createPolicy(validation.data);

    return reply.code(201).send(buildSuccessResponse({
      correlationId,
      data: policy
    }));
  }

  async function getPolicy(request: FastifyRequest<{ Params: { policyId: string } }>, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id']
      ? toCorrelationId(request.headers['x-correlation-id'] as string)
      : undefined;

    const policy = await makerCheckerApp.getPolicy(request.params.policyId);
    if (!policy) {
      return reply.code(404).send(buildErrorResponse({
        correlationId,
        error: { code: 'not_found', message: 'Policy not found' }
      }));
    }

    return reply.send(buildSuccessResponse({
      correlationId,
      data: policy
    }));
  }

  return { health, evaluateAction, createPolicy, getPolicy };
}
