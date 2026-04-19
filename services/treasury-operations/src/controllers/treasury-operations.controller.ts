import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { buildSuccessResponse } from '@faceless-banking/shared-types';
import type { TreasuryOperationsApplication } from '../application/treasury-operations.application.js';

const TransferSchema = z.object({
  fromAccount: z.string(),
  toAccount: z.string(),
  amountCents: z.coerce.string().transform(v => BigInt(v)),
  currency: z.string(),
  requestId: z.string().optional() // for idempotency
});

export function buildTreasuryOperationsController(app: TreasuryOperationsApplication) {
  async function listAccounts(request: FastifyRequest, reply: FastifyReply) {
    const data = await app.getAccounts();
    return reply.send(buildSuccessResponse({ 
      data: data.map(a => ({ ...a, balanceCents: a.balanceCents.toString() })) 
    }));
  }

  async function getTransfer(request: FastifyRequest<{ Params: { transferId: string } }>, reply: FastifyReply) {
    const t = await app.getTransfer(request.params.transferId);
    if (!t) return reply.code(404).send({ success: false, error: 'Not Found' });
    return reply.send(buildSuccessResponse({ 
      data: { ...t, amountCents: t.amountCents.toString() } 
    }));
  }

  async function initiateTransfer(request: FastifyRequest, reply: FastifyReply) {
    const params = TransferSchema.parse(request.body);
    const result = await app.initiateTransfer({
      ...params,
      idempotencyKey: params.requestId
    });
    return reply.send(buildSuccessResponse({ 
      data: { ...result, amountCents: result.amountCents.toString() } 
    }));
  }

  return { listAccounts, getTransfer, initiateTransfer };
}
