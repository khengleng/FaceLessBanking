import type { FastifyReply, FastifyRequest } from 'fastify';
import { 
  buildSuccessResponse, 
  buildErrorResponse, 
  buildValidationError,
  buildNotFoundError,
  toCorrelationId,
  type CorrelationId
} from '@faceless-banking/shared-types';

import type { CustomerApplication } from '../application/customer.application.js';
import type { CustomerProfileApplication } from '../application/customer-profile.application.js';
import type {
  CreateCustomerRequestDto,
  ListCustomersQueryDto,
  PatchCustomerProfileRequestDto
} from './dtos/customer.dto.js';
import {
  CreateCustomerSchema,
  toCustomerProfileResponseDto,
  toCustomerResponseDto
} from './dtos/customer.dto.js';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const CORRELATION_HEADER = 'x-correlation-id';

type CreateCustomerRequest = FastifyRequest<{ Body: CreateCustomerRequestDto }>;
type GetCustomerByIdRequest = FastifyRequest<{ Params: { customerId: string } }>;
type ListCustomersRequest = FastifyRequest<{ Querystring: ListCustomersQueryDto }>;
type PatchCustomerProfileRequest = FastifyRequest<{
  Params: { customerId: string };
  Body: PatchCustomerProfileRequestDto;
}>;

export function buildCustomerController(
  customerApplication: CustomerApplication,
  customerProfileApplication: CustomerProfileApplication
) {
  function log(level: 'info' | 'warn', message: string, payload: Record<string, unknown>): void {
    const out = { level, service: 'customer-service', message, ...payload };
    if (level === 'warn') {
      console.warn(JSON.stringify(out));
      return;
    }
    console.info(JSON.stringify(out));
  }

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

  async function createCustomer(
    request: CreateCustomerRequest,
    reply: FastifyReply
  ): Promise<void> {
    const correlationId = getCorrelationId(request);
    const idempotencyKey = request.headers[IDEMPOTENCY_HEADER] as string | undefined;

    if (!idempotencyKey) {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'validation_failed',
          message: 'x-idempotency-key header is required for write operations'
        }
      }));
      return;
    }

    const validationResult = CreateCustomerSchema.safeParse(request.body);
    if (!validationResult.success) {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({
          message: 'Invalid payload',
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        })
      }));
      return;
    }

    const result = await customerApplication.createCustomer(validationResult.data, idempotencyKey);

    if (result.kind === 'duplicate_idempotency') {
      reply.code(409).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'conflict',
          message: 'Idempotency key has already been processed',
          details: [`customerId: ${result.customerId}`]
        }
      }));
      return;
    }

    if (result.kind === 'invalid_payload') {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({
          message: 'Internal validation failed',
          details: result.errors
        })
      }));
      return;
    }

    reply.code(201).send(buildSuccessResponse({
      correlationId,
      data: toCustomerResponseDto(result.customer)
    }));
  }

  async function getCustomerById(
    request: GetCustomerByIdRequest,
    reply: FastifyReply
  ): Promise<void> {
    const correlationId = getCorrelationId(request);
    const auth = authorizeInternalOps(request);
    if (!auth.authorized) {
      log('warn', 'Unauthorized customer detail query', { correlationId, reason: auth.reason });
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

    const result = await customerApplication.getCustomerById(request.params.customerId);

    if (result.kind === 'not_found') {
      reply.code(404).send(buildErrorResponse({
        correlationId,
        error: buildNotFoundError('Customer not found')
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      correlationId,
      data: toCustomerResponseDto(result.customer)
    }));
  }

  async function listCustomers(request: ListCustomersRequest, reply: FastifyReply): Promise<void> {
    const correlationId = getCorrelationId(request);
    const auth = authorizeInternalOps(request);
    if (!auth.authorized) {
      log('warn', 'Unauthorized customer list query', { correlationId, reason: auth.reason });
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

    const parsedQuery: ListCustomersQueryDto = {
      customerId: request.query.customerId,
      onboardingReference: request.query.onboardingReference,
      limit: request.query.limit ? Number(request.query.limit) : undefined,
      offset: request.query.offset ? Number(request.query.offset) : undefined
    };

    const result = await customerApplication.listCustomers(parsedQuery);
    if (result.kind === 'invalid_query') {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({ details: result.errors })
      }));
      return;
    }

    const isFiltered = Boolean(parsedQuery.customerId || parsedQuery.onboardingReference);
    log('info', 'Listed customers for internal ops query', {
      correlationId,
      isFiltered,
      count: result.customers.length
    });

    reply.code(200).send(buildSuccessResponse({
      correlationId,
      data: {
        items: result.customers.map(toCustomerResponseDto)
      },
      meta: {
        limit: parsedQuery.limit ?? 50,
        offset: parsedQuery.offset ?? 0,
        filtered: isFiltered
      }
    }));
  }

  async function getCustomerProfile(
    request: GetCustomerByIdRequest,
    reply: FastifyReply
  ): Promise<void> {
    const correlationId = getCorrelationId(request);
    const auth = authorizeInternalOps(request);
    if (!auth.authorized) {
      log('warn', 'Unauthorized customer profile query', { correlationId, reason: auth.reason });
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

    const result = await customerProfileApplication.getCustomerProfile(request.params.customerId);
    if (result.kind === 'not_found') {
      reply.code(404).send(buildErrorResponse({
        correlationId,
        error: buildNotFoundError('Customer profile not found')
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      correlationId,
      data: toCustomerProfileResponseDto(result.profile)
    }));
  }

  async function patchCustomerProfile(
    request: PatchCustomerProfileRequest,
    reply: FastifyReply
  ): Promise<void> {
    const correlationId = getCorrelationId(request);
    const result = await customerProfileApplication.patchCustomerProfile(
      request.params.customerId,
      request.body
    );

    if (result.kind === 'invalid_patch') {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({
          message: 'Invalid profile patch payload',
          details: result.errors
        })
      }));
      return;
    }

    if (result.kind === 'customer_not_found') {
      reply.code(404).send(buildErrorResponse({
        correlationId,
        error: buildNotFoundError('Customer not found')
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      correlationId,
      data: toCustomerProfileResponseDto(result.profile)
    }));
  }

  return {
    createCustomer,
    getCustomerById,
    listCustomers,
    getCustomerProfile,
    patchCustomerProfile
  };
}
