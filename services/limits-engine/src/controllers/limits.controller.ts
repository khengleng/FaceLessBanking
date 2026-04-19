import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { buildSuccessResponse } from '@faceless-banking/shared-types';
import type { LimitsApplication } from '../application/limits.application.js';
import type { LimitRule } from '../domain/limits.js';

const EvaluateSchema = z.object({
  entityType: z.enum(['CUSTOMER', 'ACCOUNT']),
  entityId: z.string(),
  amountCents: z.coerce.string().transform(v => BigInt(v)),
  currency: z.string(),
  action: z.string()
});

const RuleSchema = z.object({
  ruleId: z.string(),
  entityType: z.enum(['CUSTOMER', 'ACCOUNT']),
  entityId: z.string(),
  limitType: z.enum([
    'DAILY_TX_LIMIT',
    'MONTHLY_TX_LIMIT',
    'LOAN_EXPOSURE_LIMIT',
    'ACCOUNT_BALANCE_LIMIT'
  ]),
  thresholdAmountCents: z.coerce.string().transform(v => BigInt(v)),
  currency: z.string(),
  period: z.enum(['DAILY', 'MONTHLY', 'INFINITE']),
  requireApproval: z.boolean()
});

export function buildLimitsController(app: LimitsApplication) {
  async function evaluate(request: FastifyRequest, reply: FastifyReply) {
    const params = EvaluateSchema.parse(request.body);
    const result = await app.evaluateLimit(params);
    return reply.send(buildSuccessResponse({ data: {
      ...result,
      amountCents: params.amountCents.toString()
    } }));
  }

  async function createRule(request: FastifyRequest, reply: FastifyReply) {
    const rule = RuleSchema.parse(request.body);
    const limitRule: LimitRule = { ...rule, status: 'ACTIVE' };
    await app.createRule(limitRule);
    return reply.send(buildSuccessResponse({ data: { ruleId: rule.ruleId } }));
  }

  async function getRule(request: FastifyRequest<{ Params: { ruleId: string } }>, reply: FastifyReply) {
    const rule = await app.getRule(request.params.ruleId);
    if (!rule) return reply.code(404).send({ success: false, error: 'Not Found' });
    return reply.send(buildSuccessResponse({ data: {
      ...rule,
      thresholdAmountCents: rule.thresholdAmountCents.toString()
    } }));
  }

  return { evaluate, createRule, getRule };
}
