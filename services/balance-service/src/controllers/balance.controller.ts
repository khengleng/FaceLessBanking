import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildErrorResponse,
  buildNotFoundError,
  buildSuccessResponse,
  buildValidationError,
  toCorrelationId
} from '@faceless-banking/shared-types';

import type { BalanceApplication } from '../application/balance.application.js';
import { AccountIdSchema, toBalanceResponseDto } from './dtos/balance.dto.js';

type GetBalanceRequest = FastifyRequest<{ Params: { accountId: string } }>;

function resolveCorrelationId(request: FastifyRequest): string {
  const value = request.headers['x-correlation-id'];
  if (Array.isArray(value)) {
    return value[0] ?? 'unknown-correlation-id';
  }

  return typeof value === 'string' ? value : 'unknown-correlation-id';
}

export function buildBalanceController(balanceApplication: BalanceApplication) {
  async function getBalance(request: GetBalanceRequest, reply: FastifyReply): Promise<void> {
    const correlationId = resolveCorrelationId(request);

    const accountIdResult = AccountIdSchema.safeParse(request.params.accountId);
    if (!accountIdResult.success) {
      reply.code(400).send(buildErrorResponse({
        error: buildValidationError({
          message: 'Invalid accountId',
          details: accountIdResult.error.errors.map((issue) => issue.message)
        }),
        correlationId: toCorrelationId(correlationId)
      }));
      return;
    }

    request.log.info({
      correlationId,
      accountId: accountIdResult.data,
      operation: 'balance.read'
    }, 'Reading balance snapshot');

    const result = await balanceApplication.getBalance(accountIdResult.data);

    if (result.kind === 'not_found') {
      reply.code(404).send(buildErrorResponse({
        error: buildNotFoundError('Balance snapshot not found'),
        correlationId: toCorrelationId(correlationId)
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      data: {
        ...toBalanceResponseDto(result.snapshot),
        source: result.source
      },
      correlationId: toCorrelationId(correlationId)
    }));
  }

  return {
    getBalance
  };
}
