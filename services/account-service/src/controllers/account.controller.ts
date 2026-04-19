import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildErrorResponse,
  buildNotFoundError,
  buildSuccessResponse,
  buildValidationError,
  toCorrelationId,
  type CorrelationId
} from '@faceless-banking/shared-types';

import type { AccountApplication } from '../application/account.application.js';
import type { AccountActivationApplication } from '../application/account-activation.application.js';
import type { DepositInterestAccrualApplication } from '../application/deposit-interest-accrual.application.js';
import type {
  ActivateAccountRequestDto,
  CreateAccountRequestDto,
  ListAccountsQueryDto
} from './dtos/account.dto.js';
import {
  toAccountBalanceResponseDto,
  toAccountResponseDto
} from './dtos/account.dto.js';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const CORRELATION_HEADER = 'x-correlation-id';

type CreateAccountRequest = FastifyRequest<{ Body: CreateAccountRequestDto }>;
type GetAccountRequest = FastifyRequest<{ Params: { accountId: string } }>;
type ListAccountsRequest = FastifyRequest<{ Querystring: ListAccountsQueryDto }>;
type ActivateAccountRequest = FastifyRequest<{
  Params: { accountId: string };
  Body: ActivateAccountRequestDto;
}>;

export function buildAccountController(
  accountApplication: AccountApplication,
  accountActivationApplication?: AccountActivationApplication,
  interestAccrualApplication?: DepositInterestAccrualApplication
) {
  function getCorrelationId(request: FastifyRequest): CorrelationId | undefined {
    const header = request.headers[CORRELATION_HEADER];
    return typeof header === 'string' ? toCorrelationId(header) : undefined;
  }

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

  async function createAccount(request: CreateAccountRequest, reply: FastifyReply): Promise<void> {
    const correlationId = getCorrelationId(request);
    const idempotencyKeyHeader = request.headers[IDEMPOTENCY_HEADER];
    const idempotencyKey =
      typeof idempotencyKeyHeader === 'string' && idempotencyKeyHeader.length > 0
        ? idempotencyKeyHeader
        : undefined;

    const result = await accountApplication.createAccount(request.body, idempotencyKey);

    if (result.kind === 'idempotency_key_required') {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({
          message: 'x-idempotency-key header is required for write operations'
        })
      }));
      return;
    }

    if (result.kind === 'duplicate_idempotency') {
      reply.code(409).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'conflict',
          message: 'Idempotency key has already been processed',
          details: [`accountId: ${result.accountId}`]
        }
      }));
      return;
    }

    if (result.kind === 'invalid_payload') {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({ details: result.errors })
      }));
      return;
    }

    reply.code(201).send(buildSuccessResponse({
      correlationId,
      data: toAccountResponseDto(result.account)
    }));
  }

  async function getAccountById(request: GetAccountRequest, reply: FastifyReply): Promise<void> {
    const correlationId = getCorrelationId(request);
    const auth = authorizeInternalOps(request);
    if (!auth.authorized) {
      reply.code(403).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'forbidden',
          message: auth.reason ?? 'Forbidden',
          retriable: false
        }
      }));
      return;
    }

    const result = await accountApplication.getAccountById(request.params.accountId);

    if (result.kind === 'not_found') {
      reply.code(404).send(buildErrorResponse({
        correlationId,
        error: buildNotFoundError('Account not found')
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      correlationId,
      data: toAccountResponseDto(result.account)
    }));
  }

  async function getAccountBalance(request: GetAccountRequest, reply: FastifyReply): Promise<void> {
    const correlationId = getCorrelationId(request);
    const result = await accountApplication.getAccountBalance(request.params.accountId);

    if (result.kind === 'not_found') {
      reply.code(404).send(buildErrorResponse({
        correlationId,
        error: buildNotFoundError('Account not found')
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      correlationId,
      data: toAccountBalanceResponseDto(result.account)
    }));
  }

  async function listAccounts(request: ListAccountsRequest, reply: FastifyReply): Promise<void> {
    const correlationId = getCorrelationId(request);
    const auth = authorizeInternalOps(request);
    if (!auth.authorized) {
      reply.code(403).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'forbidden',
          message: auth.reason ?? 'Forbidden',
          retriable: false
        }
      }));
      return;
    }

    const parsedQuery: ListAccountsQueryDto = {
      customerId: request.query.customerId,
      accountId: request.query.accountId,
      onboardingReference: request.query.onboardingReference,
      limit: request.query.limit ? Number(request.query.limit) : undefined,
      offset: request.query.offset ? Number(request.query.offset) : undefined
    };

    const result = await accountApplication.listAccounts(parsedQuery);
    if (result.kind === 'invalid_query') {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({ details: result.errors })
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      correlationId,
      data: {
        items: result.accounts.map(toAccountResponseDto)
      },
      meta: {
        limit: parsedQuery.limit ?? 50,
        offset: parsedQuery.offset ?? 0,
        filtered: Boolean(parsedQuery.customerId || parsedQuery.accountId || parsedQuery.onboardingReference)
      }
    }));
  }

  async function activateAccount(request: ActivateAccountRequest, reply: FastifyReply): Promise<void> {
    const correlationId = getCorrelationId(request);
    const auth = authorizeInternalOps(request);
    if (!auth.authorized) {
      reply.code(403).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'forbidden',
          message: auth.reason ?? 'Forbidden',
          retriable: false
        }
      }));
      return;
    }

    if (!accountActivationApplication) {
      reply.code(500).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'internal_error',
          message: 'Account activation flow is not configured',
          retriable: false
        }
      }));
      return;
    }

    const idempotencyKeyHeader = request.headers[IDEMPOTENCY_HEADER];
    const idempotencyKey =
      typeof idempotencyKeyHeader === 'string' && idempotencyKeyHeader.length > 0
        ? idempotencyKeyHeader
        : undefined;

    if (!request.params.accountId || request.params.accountId.trim().length < 2) {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({
          details: ['accountId must contain at least 2 characters']
        })
      }));
      return;
    }

    const result = await accountActivationApplication.activateAccountManually({
      accountId: request.params.accountId,
      idempotencyKey,
      correlationId: correlationId ?? `corr-account-activation-${request.params.accountId}`
    });

    if (result.kind === 'idempotency_key_required') {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({
          message: 'x-idempotency-key header is required for write operations'
        })
      }));
      return;
    }

    if (result.kind === 'account_not_found') {
      reply.code(404).send(buildErrorResponse({
        correlationId,
        error: buildNotFoundError('Account not found')
      }));
      return;
    }

    if (result.kind === 'invalid_transition') {
      reply.code(409).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'conflict',
          message: result.reason,
          retriable: false
        }
      }));
      return;
    }

    if (result.kind === 'duplicate_idempotency' || result.kind === 'already_active') {
      reply.code(200).send(buildSuccessResponse({
        correlationId,
        data: toAccountResponseDto(result.account)
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      correlationId,
      data: toAccountResponseDto(result.account)
    }));
  }

  async function accrueInterest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const correlationId = getCorrelationId(request);
    const auth = authorizeInternalOps(request);
    if (!auth.authorized) {
      reply.code(403).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'forbidden',
          message: auth.reason ?? 'Forbidden',
          retriable: false
        }
      }));
      return;
    }

    if (!interestAccrualApplication) {
      reply.code(500).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'internal_error',
          message: 'Interest accrual application is not configured',
          retriable: false
        }
      }));
      return;
    }

    const result = await interestAccrualApplication.processDailyAccrual();

    reply.code(200).send(buildSuccessResponse({
      correlationId,
      data: result
    }));
  }

  return {
    createAccount,
    getAccountById,
    getAccountBalance,
    listAccounts,
    activateAccount,
    accrueInterest
  };
}
