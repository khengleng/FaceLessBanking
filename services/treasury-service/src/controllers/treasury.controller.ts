import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { buildSuccessResponse } from '@faceless-banking/shared-types';
import type { TreasuryApplication } from '../application/treasury.application.js';

const TransferSchema = z.object({
  sourceAccountId: z.string(),
  destinationAccountId: z.string(),
  amountCents: z.coerce.string().transform(v => BigInt(v)),
  currency: z.string(),
  purpose: z.string()
});

const AccountSchema = z.object({
  accountId: z.string(),
  name: z.string(),
  category: z.enum(['RESERVE', 'NOSTRO', 'FEE_PROCEEDS', 'LOAN_FUNDING']),
  currency: z.string()
});

export function buildTreasuryController(app: TreasuryApplication) {
  async function listAccounts(request: FastifyRequest, reply: FastifyReply) {
    const data = await app.getAccounts();
    return reply.send(buildSuccessResponse({ data }));
  }

  async function createAccount(request: FastifyRequest, reply: FastifyReply) {
    const account = AccountSchema.parse(request.body);
    await app.createAccount({ ...account, status: 'ACTIVE' });
    return reply.send(buildSuccessResponse({ data: { accountId: account.accountId } }));
  }

  async function initiateTransfer(request: FastifyRequest, reply: FastifyReply) {
    const params = TransferSchema.parse(request.body);
    const result = await app.initiateRebalance(params);
    return reply.send(buildSuccessResponse({ data: {
      ...result,
      amountCents: result.amountCents.toString()
    } }));
  }

  return { listAccounts, createAccount, initiateTransfer };
}
