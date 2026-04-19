import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildSuccessResponse } from '@faceless-banking/shared-types';
import type { LiquidityApplication } from '../application/liquidity.application.js';

export function buildLiquidityController(app: LiquidityApplication) {
  async function getPositions(request: FastifyRequest, reply: FastifyReply) {
    const data = await app.getPositions();
    return reply.send(buildSuccessResponse({ 
      data: data.map(p => ({
        ...p,
        availableCash: p.availableCash.toString(),
        reservedCash: p.reservedCash.toString(),
        outgoingPending: p.outgoingPending.toString(),
        incomingPending: p.incomingPending.toString()
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
        availableCash: p.availableCash.toString(),
        reservedCash: p.reservedCash.toString(),
        outgoingPending: p.outgoingPending.toString(),
        incomingPending: p.incomingPending.toString()
      }
    }));
  }

  async function getSummary(request: FastifyRequest, reply: FastifyReply) {
    const data = await app.getSummary();
    return reply.send(buildSuccessResponse({ data }));
  }

  return { getPositions, getPositionByCurrency, getSummary };
}
