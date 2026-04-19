import type { FastifyReply, FastifyRequest } from 'fastify';

import type { LoanApplication } from '../application/loan.application.js';
import type {
  CreateLoanRequestDto,
  CreateRepaymentRequestDto
} from './dtos/loan.dto.js';
import {
  toLoanResponseDto,
  toRepaymentResponseDto
} from './dtos/loan.dto.js';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';

type CreateLoanRequest = FastifyRequest<{ Body: CreateLoanRequestDto }>;
type GetLoanRequest = FastifyRequest<{ Params: { loanId: string } }>;
type InitiateRepaymentRequest = FastifyRequest<{
  Params: { loanAccountId: string };
  Body: CreateRepaymentRequestDto;
}>;

export function buildLoanController(loanApplication: LoanApplication) {
  function resolveCorrelationId(request: FastifyRequest): string {
    const value = request.headers['x-correlation-id'];
    if (Array.isArray(value)) {
      return value[0] ?? 'unknown-correlation-id';
    }

    return typeof value === 'string' && value.length > 0 ? value : 'unknown-correlation-id';
  }

  async function createLoan(request: CreateLoanRequest, reply: FastifyReply): Promise<void> {
    const idempotencyKeyHeader = request.headers[IDEMPOTENCY_HEADER];
    const idempotencyKey =
      typeof idempotencyKeyHeader === 'string' && idempotencyKeyHeader.length > 0
        ? idempotencyKeyHeader
        : undefined;

    const result = await loanApplication.createLoan(request.body, idempotencyKey);

    if (result.kind === 'idempotency_key_required') {
      reply.code(400).send({
        error: 'idempotency_key_required',
        message: 'x-idempotency-key header is required for write operations'
      });
      return;
    }

    if (result.kind === 'duplicate_idempotency') {
      reply.code(409).send({
        error: 'duplicate_idempotency_key',
        message: 'Idempotency key has already been processed',
        referenceId: result.referenceId
      });
      return;
    }

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    if (result.kind === 'rule_rejected') {
      reply.code(422).send({
        error: 'loan_rule_rejected',
        message: 'Loan application was rejected by eligibility placeholder rules',
        reason: result.reason
      });
      return;
    }

    reply.code(201).send(toLoanResponseDto(result.loan));
  }

  async function getLoanById(request: GetLoanRequest, reply: FastifyReply): Promise<void> {
    const result = await loanApplication.getLoanById(request.params.loanId);

    if (result.kind === 'not_found') {
      reply.code(404).send({ error: 'loan_not_found' });
      return;
    }

    reply.code(200).send(toLoanResponseDto(result.loan));
  }

  async function initiateRepayment(
    request: InitiateRepaymentRequest,
    reply: FastifyReply
  ): Promise<void> {
    const idempotencyKeyHeader = request.headers[IDEMPOTENCY_HEADER];
    const idempotencyKey =
      typeof idempotencyKeyHeader === 'string' && idempotencyKeyHeader.length > 0
        ? idempotencyKeyHeader
        : undefined;

    const result = await loanApplication.initiateRepayment(
      request.params.loanAccountId,
      request.body,
      idempotencyKey,
      resolveCorrelationId(request)
    );

    if (result.kind === 'idempotency_key_required') {
      reply.code(400).send({
        error: 'idempotency_key_required',
        message: 'x-idempotency-key header is required for write operations'
      });
      return;
    }

    if (result.kind === 'duplicate_idempotency') {
      reply.code(409).send({
        error: 'duplicate_idempotency_key',
        message: 'Idempotency key has already been processed',
        referenceId: result.referenceId
      });
      return;
    }

    if (result.kind === 'loan_not_found') {
      reply.code(404).send({ error: 'loan_not_found' });
      return;
    }

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    reply.code(201).send(toRepaymentResponseDto(result.repayment));
  }

  return {
    createLoan,
    getLoanById,
    initiateRepayment
  };
}
