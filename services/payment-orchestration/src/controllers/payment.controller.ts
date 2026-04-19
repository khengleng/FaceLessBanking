import { randomUUID } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildErrorResponse,
  buildNotFoundError,
  buildSuccessResponse,
  buildValidationError,
  toCorrelationId
} from '@faceless-banking/shared-types';

import type { PaymentApplication } from '../application/payment.application.js';
import type {
  CreateBeneficiaryRequestDto,
  InternalTransferRequestDto,
  ListPaymentsQueryDto
} from './dtos/payment.dto.js';
import {
  InternalTransferSchema,
  toBeneficiaryResponseDto,
  toPaymentResponseDto
} from './dtos/payment.dto.js';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const CORRELATION_HEADER = 'x-correlation-id';

type InternalTransferRequest = FastifyRequest<{ Body: InternalTransferRequestDto }>;
type GetPaymentRequest = FastifyRequest<{ Params: { paymentId: string } }>;
type ListPaymentsRequest = FastifyRequest<{ Querystring: ListPaymentsQueryDto }>;
type CreateBeneficiaryRequest = FastifyRequest<{ Body: CreateBeneficiaryRequestDto }>;

function resolveCorrelationId(request: FastifyRequest): string {
  const value = request.headers[CORRELATION_HEADER];
  if (Array.isArray(value)) {
    return value[0] ?? randomUUID();
  }

  return typeof value === 'string' && value.length > 0 ? value : randomUUID();
}

export function buildPaymentController(paymentApplication: PaymentApplication) {
  function authorizeInternalOps(request: FastifyRequest): { authorized: boolean; reason?: string } {
    const roleHeader = request.headers['x-internal-ops-role'];
    const actorIdHeader = request.headers['x-internal-ops-actor-id'];
    const role = typeof roleHeader === 'string' ? roleHeader : '';
    const actorId = typeof actorIdHeader === 'string' ? actorIdHeader : '';
    const allowedRoles = ['ops', 'compliance'];

    if (!actorId || actorId.trim().length < 3) {
      return { authorized: false, reason: 'x-internal-ops-actor-id is required' };
    }

    if (!allowedRoles.includes(role)) {
      return { authorized: false, reason: 'x-internal-ops-role must be ops or compliance' };
    }

    return { authorized: true };
  }

  async function initiateInternalTransfer(
    request: InternalTransferRequest,
    reply: FastifyReply
  ): Promise<void> {
    const correlationId = resolveCorrelationId(request);

    const idempotencyKeyHeader = request.headers[IDEMPOTENCY_HEADER];
    const idempotencyKey =
      typeof idempotencyKeyHeader === 'string' && idempotencyKeyHeader.length > 0
        ? idempotencyKeyHeader
        : undefined;

    if (!idempotencyKey) {
      reply.code(400).send(buildErrorResponse({
        error: buildValidationError({
          message: 'x-idempotency-key header is required for write operations'
        }),
        correlationId: toCorrelationId(correlationId)
      }));
      return;
    }

    const parsed = InternalTransferSchema.safeParse(request.body);
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
      operation: 'payment.initiate',
      sourceAccountId: parsed.data.sourceAccountId,
      destinationAccountId: parsed.data.destinationAccountId
    }, 'Accepting internal transfer request');

    const result = await paymentApplication.initiateInternalTransfer(
      parsed.data,
      idempotencyKey,
      correlationId
    );

    if (result.kind === 'duplicate_idempotency') {
      reply.code(200).send(buildSuccessResponse({
        data: toPaymentResponseDto(result.payment),
        correlationId: toCorrelationId(correlationId)
      }));
      return;
    }

    if (result.kind === 'idempotency_key_required') {
      reply.code(400).send(buildErrorResponse({
        error: buildValidationError({
          message: 'x-idempotency-key header is required for write operations'
        }),
        correlationId: toCorrelationId(correlationId)
      }));
      return;
    }

    reply.code(202).send(buildSuccessResponse({
      data: {
        ...toPaymentResponseDto(result.payment),
        publishState: result.publishState
      },
      correlationId: toCorrelationId(correlationId)
    }));
  }

  async function getPaymentById(request: GetPaymentRequest, reply: FastifyReply): Promise<void> {
    const correlationId = resolveCorrelationId(request);
    const auth = authorizeInternalOps(request);
    if (!auth.authorized) {
      reply.code(403).send(buildErrorResponse({
        error: {
          code: 'forbidden',
          message: auth.reason ?? 'Forbidden',
          retriable: false
        },
        correlationId: toCorrelationId(correlationId)
      }));
      return;
    }

    const result = await paymentApplication.getPaymentById(request.params.paymentId);

    if (result.kind === 'not_found') {
      reply.code(404).send(buildErrorResponse({
        error: buildNotFoundError('Payment not found'),
        correlationId: toCorrelationId(correlationId)
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      data: toPaymentResponseDto(result.payment),
      correlationId: toCorrelationId(correlationId)
    }));
  }

  async function listPayments(request: ListPaymentsRequest, reply: FastifyReply): Promise<void> {
    const correlationId = resolveCorrelationId(request);
    const auth = authorizeInternalOps(request);
    if (!auth.authorized) {
      reply.code(403).send(buildErrorResponse({
        error: {
          code: 'forbidden',
          message: auth.reason ?? 'Forbidden',
          retriable: false
        },
        correlationId: toCorrelationId(correlationId)
      }));
      return;
    }

    const parsedQuery: ListPaymentsQueryDto = {
      status: request.query.status,
      accountId: request.query.accountId,
      correlationId: request.query.correlationId,
      limit: request.query.limit ? Number(request.query.limit) : undefined,
      offset: request.query.offset ? Number(request.query.offset) : undefined
    };

    const result = await paymentApplication.listPayments(parsedQuery);
    if (result.kind === 'invalid_query') {
      reply.code(400).send(buildErrorResponse({
        error: buildValidationError({ details: result.errors }),
        correlationId: toCorrelationId(correlationId)
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      data: {
        items: result.payments.map(toPaymentResponseDto)
      },
      meta: {
        limit: parsedQuery.limit ?? 50,
        offset: parsedQuery.offset ?? 0,
        filtered: Boolean(parsedQuery.status || parsedQuery.accountId || parsedQuery.correlationId)
      },
      correlationId: toCorrelationId(correlationId)
    }));
  }

  async function createBeneficiary(
    request: CreateBeneficiaryRequest,
    reply: FastifyReply
  ): Promise<void> {
    const correlationId = resolveCorrelationId(request);
    const result = await paymentApplication.createBeneficiary(request.body);

    if (result.kind === 'invalid_payload') {
      reply.code(400).send(buildErrorResponse({
        error: buildValidationError({
          message: 'Invalid payload',
          details: result.errors
        }),
        correlationId: toCorrelationId(correlationId)
      }));
      return;
    }

    reply.code(201).send(buildSuccessResponse({
      data: toBeneficiaryResponseDto(result.beneficiary),
      correlationId: toCorrelationId(correlationId)
    }));
  }

  return {
    initiateInternalTransfer,
    listPayments,
    getPaymentById,
    createBeneficiary
  };
}
