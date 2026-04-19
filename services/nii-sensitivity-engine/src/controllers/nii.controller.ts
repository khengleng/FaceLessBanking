import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { buildSuccessResponse } from '@faceless-banking/shared-types';
import type { NIIApplication } from '../application/nii.application.js';

const ShockSchema = z.object({
  basisPointsShift: z.number()
});

export function buildNIIController(app: NIIApplication) {
  async function getBaseline(request: FastifyRequest<{ Params: { currency?: string } }>, reply: FastifyReply) {
    const currency = request.params.currency || 'USD';
    const data = await app.getBaselineNii(currency);
    return reply.send(buildSuccessResponse({ 
      data: {
        currency: data.currency,
        baselineAnnualizedCents: data.baselineAnnualizedCents.toString()
      }
    }));
  }

  async function simulateShock(request: FastifyRequest<{ Params: { currency?: string } }>, reply: FastifyReply) {
    const currency = request.params.currency || 'USD';
    const body = ShockSchema.parse(request.body);
    
    const result = await app.calculateShockImpact(currency, {
      scenarioId: 'CUSTOM_SHOCK',
      name: `Custom Shock ${body.basisPointsShift} bps`,
      basisPointsShift: body.basisPointsShift
    });

    return reply.send(buildSuccessResponse({ 
      data: {
        ...result,
        projectedNiiDeltaCents: result.projectedNiiDeltaCents.toString(),
        baselineNiiAnnualizedCents: result.baselineNiiAnnualizedCents.toString(),
        projectedNewNiiCents: result.projectedNewNiiCents.toString()
      }
    }));
  }

  async function getStandardScenarios(request: FastifyRequest<{ Params: { currency?: string } }>, reply: FastifyReply) {
    const currency = request.params.currency || 'USD';
    const results = await app.executeStandardScenarios(currency);
    
    return reply.send(buildSuccessResponse({ 
      data: results.map(r => ({
        ...r,
        projectedNiiDeltaCents: r.projectedNiiDeltaCents.toString(),
        baselineNiiAnnualizedCents: r.baselineNiiAnnualizedCents.toString(),
        projectedNewNiiCents: r.projectedNewNiiCents.toString()
      }))
    }));
  }

  return { getBaseline, simulateShock, getStandardScenarios };
}
