import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildErrorResponse,
  buildSuccessResponse,
  buildValidationError,
  toCorrelationId
} from '@faceless-banking/shared-types';

import type { BalanceApplication } from '../application/balance.application.js';
import {
  ApplyProjectionEventSchema,
  toBalanceProjectionEvent,
  toBalanceResponseDto,
  type ApplyProjectionEventRequestDto
} from './dtos/balance.dto.js';

type ApplyProjectionRequest = FastifyRequest<{ Body: ApplyProjectionEventRequestDto }>;

function resolveCorrelationId(request: FastifyRequest): string {
  const value = request.headers['x-correlation-id'];
  if (Array.isArray(value)) {
    return value[0] ?? 'unknown-correlation-id';
  }

  return typeof value === 'string' ? value : 'unknown-correlation-id';
}

export function buildInternalBalanceController(balanceApplication: BalanceApplication) {
  async function applyProjectionEvent(
    request: ApplyProjectionRequest,
    reply: FastifyReply
  ): Promise<void> {
    const correlationId = resolveCorrelationId(request);

    const isInternalRequest = request.headers['x-internal-request'] === 'true';
    if (!isInternalRequest) {
      reply.code(403).send(buildErrorResponse({
        error: {
          code: 'forbidden',
          message: 'Internal-only endpoint'
        },
        correlationId: toCorrelationId(correlationId)
      }));
      return;
    }

    const parsed = ApplyProjectionEventSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send(buildErrorResponse({
        error: buildValidationError({
          message: 'Invalid payload',
          details: parsed.error.errors.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        }),
        correlationId: toCorrelationId(correlationId)
      }));
      return;
    }

    request.log.info({
      correlationId,
      eventId: parsed.data.eventId,
      accountId: parsed.data.accountId,
      operation: 'balance.projection.apply'
    }, 'Applying balance projection event');

    const result = await balanceApplication.applyProjectionEvent(toBalanceProjectionEvent(parsed.data));

    if (result.kind === 'duplicate_event') {
      reply.code(200).send(buildSuccessResponse({
        data: { status: 'duplicate_event' },
        correlationId: toCorrelationId(correlationId)
      }));
      return;
    }

    if (result.kind === 'stale_event') {
      reply.code(200).send(buildSuccessResponse({
        data: {
          status: 'stale_event',
          currentVersion: result.currentVersion
        },
        correlationId: toCorrelationId(correlationId)
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      data: {
        status: 'applied',
        snapshot: toBalanceResponseDto(result.snapshot)
      },
      correlationId: toCorrelationId(correlationId)
    }));
  }

  return {
    applyProjectionEvent
  };
}
