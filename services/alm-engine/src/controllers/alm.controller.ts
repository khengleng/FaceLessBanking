import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildSuccessResponse } from '@faceless-banking/shared-types';
import type { ALMApplication } from '../application/alm.application.js';

export function buildALMController(app: ALMApplication) {
  async function getPositions(request: FastifyRequest, reply: FastifyReply) {
    const data = await app.aggregatePositions();
    return reply.send(buildSuccessResponse({ 
      data: data.map(p => ({
        ...p,
        totalAssetsCents: p.totalAssetsCents.toString(),
        totalLiabilitiesCents: p.totalLiabilitiesCents.toString(),
        netPositionCents: p.netPositionCents.toString()
      })) 
    }));
  }

  async function getPositionByCurrency(request: FastifyRequest<{ Params: { currency: string } }>, reply: FastifyReply) {
    const p = await app.getPositionByCurrency(request.params.currency);
    if (!p) {
      return reply.code(404).send({ success: false, error: 'Not Found' });
    }
    return reply.send(buildSuccessResponse({ 
      data: {
        ...p,
        totalAssetsCents: p.totalAssetsCents.toString(),
        totalLiabilitiesCents: p.totalLiabilitiesCents.toString(),
        netPositionCents: p.netPositionCents.toString()
      }
    }));
  }

  async function getSummary(request: FastifyRequest, reply: FastifyReply) {
    const positions = await app.aggregatePositions();
    
    // In a real scenario, we'd use FX rates to normalize to USD
    // For this skeleton, we just sum up the bigints regardless of currency for demonstration
    const totalAssets = positions.reduce((acc, p) => acc + p.totalAssetsCents, 0n);
    const totalLiabs = positions.reduce((acc, p) => acc + p.totalLiabilitiesCents, 0n);

    return reply.send(buildSuccessResponse({ 
      data: {
        totalAssets: totalAssets.toString(),
        totalLiabilities: totalLiabs.toString(),
        netPosition: (totalAssets - totalLiabs).toString(),
        currenciesCount: positions.length
      }
    }));
  }

  async function getMaturityBuckets(request: FastifyRequest<{ Querystring: { currency?: string } }>, reply: FastifyReply) {
    const currency = request.query.currency || 'USD';
    const buckets = await app.calculateMaturityBuckets(currency);
    
    return reply.send(buildSuccessResponse({ 
      data: buckets.map(b => ({
        ...b,
        inflowCents: b.inflowCents.toString(),
        outflowCents: b.outflowCents.toString(),
        netGapCents: b.netGapCents.toString()
      }))
    }));
  }

  async function getMetrics(request: FastifyRequest<{ Querystring: { currency?: string } }>, reply: FastifyReply) {
    const currency = request.query.currency || 'USD';
    const metrics = await app.calculateRiskMetrics(currency);
    
    if (!metrics) return reply.code(404).send({ success: false, error: 'Not Found' });
    
    return reply.send(buildSuccessResponse({ data: metrics }));
  }

  return { getPositions, getPositionByCurrency, getSummary, getMaturityBuckets, getMetrics };
}
