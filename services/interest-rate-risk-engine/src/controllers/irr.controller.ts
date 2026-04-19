import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  buildErrorResponse,
  buildNotFoundError,
  buildSuccessResponse,
  buildValidationError
} from '@faceless-banking/shared-types';
import type { IRRApplication } from '../application/irr.application.js';

const ScenarioPayloadSchema = z.object({
  shockBps: z.number()
});

const RunScenarioPayloadSchema = z.object({
  scenarioId: z.string().optional(),
  currency: z.string().trim().length(3).optional(),
  shockBps: z.number().int().min(-5000).max(5000).optional()
});

export function buildIRRController(app: IRRApplication) {
  async function getRepricingGaps(request: FastifyRequest<{ Params: { currency?: string } }>, reply: FastifyReply) {
    const currency = request.params.currency || 'USD';
    const data = await app.calculateRepricingGaps(currency);
    
    return reply.send(buildSuccessResponse({ 
      data: data.map(b => ({
        ...b,
        repricingAssets: b.repricingAssets.toString(),
        repricingLiabilities: b.repricingLiabilities.toString(),
        gap: b.gap.toString(),
        cumulativeGap: b.cumulativeGap.toString()
      })) 
    }));
  }

  async function getNIISensitivity(request: FastifyRequest<{ Params: { currency?: string } }>, reply: FastifyReply) {
    const currency = request.params.currency || 'USD';
    
    // Calculate standard parallel shock scenarios (+/-100 bps, +/-200 bps)
    const shocks = [100, -100, 200, -200];
    const scenarios = await Promise.all(
      shocks.map(bps => app.calculateNIISensitivity(currency, bps))
    );

    return reply.send(buildSuccessResponse({ 
      data: scenarios 
    }));
  }

  async function postNIISensitivityScenario(request: FastifyRequest<{ Params: { currency?: string } }>, reply: FastifyReply) {
    const currency = request.params.currency || 'USD';
    
    const parsed = ScenarioPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(buildErrorResponse({
        error: buildValidationError({ message: 'Invalid scenario payload' })
      }));
    }

    const result = await app.calculateNIISensitivity(currency, parsed.data.shockBps);
    return reply.send(buildSuccessResponse({ data: result }));
  }

  async function getScenarios(request: FastifyRequest, reply: FastifyReply) {
    const scenarios = app.getScenarios();
    return reply.send(buildSuccessResponse({ data: scenarios }));
  }

  async function postRunScenario(request: FastifyRequest, reply: FastifyReply) {
    const parsed = RunScenarioPayloadSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send(buildErrorResponse({
        error: buildValidationError({ message: 'Invalid payload' })
      }));
    }

    const { currency = 'USD', shockBps } = parsed.data;
    const normalizedScenarioId = parsed.data.scenarioId ?? (shockBps !== undefined ? 'CUSTOM_SCENARIO' : '');

    if (!normalizedScenarioId) {
      return reply.code(400).send(buildErrorResponse({
        error: buildValidationError({ message: 'scenarioId is required unless shockBps is provided for custom scenario' })
      }));
    }

    if (normalizedScenarioId === 'CUSTOM_SCENARIO' && shockBps === undefined) {
      return reply.code(400).send(buildErrorResponse({
        error: buildValidationError({ message: 'shockBps is required for CUSTOM_SCENARIO' })
      }));
    }

    try {
      const result = await app.runScenario({
        scenarioId: normalizedScenarioId,
        currency,
        customShockBps: shockBps
      });

      return reply.send(buildSuccessResponse({ data: result }));
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'scenario_not_found') {
        return reply.code(404).send(buildErrorResponse({
          error: buildNotFoundError('Scenario not found')
        }));
      }

      throw error;
    }
  }

  async function getScenarioResult(
    request: FastifyRequest<{ Params: { scenarioId: string }; Querystring: { currency?: string } }>,
    reply: FastifyReply
  ) {
    const scenarioId = request.params.scenarioId;
    const currency = request.query.currency ?? 'USD';

    const result = await app.getScenarioResult(scenarioId, currency);
    if (!result) {
      return reply.code(404).send(buildErrorResponse({
        error: buildNotFoundError('Scenario result not found')
      }));
    }

    return reply.send(buildSuccessResponse({ data: result }));
  }

  return {
    getRepricingGaps,
    getNIISensitivity,
    postNIISensitivityScenario,
    getScenarios,
    postRunScenario,
    getScenarioResult
  };
}
