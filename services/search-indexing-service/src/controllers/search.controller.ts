import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildErrorResponse,
  buildNotFoundError,
  buildSuccessResponse,
  buildValidationError,
  toCorrelationId,
  type CorrelationId
} from '@faceless-banking/shared-types';

import type { SearchIndexingApplication } from '../application/search-indexing.application.js';
import {
  EntityLookupParamsSchema,
  SearchQuerySchema,
  toSearchItemDto,
  type EntityLookupParamsDto,
  type SearchQueryDto
} from './dtos/search.dto.js';

type SearchRequest = FastifyRequest<{ Querystring: SearchQueryDto }>;
type EntityLookupRequest = FastifyRequest<{ Params: EntityLookupParamsDto }>;

export function buildSearchController(application: SearchIndexingApplication) {
  function getCorrelationId(request: FastifyRequest): CorrelationId | undefined {
    const header = request.headers['x-correlation-id'];
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

  async function search(request: SearchRequest, reply: FastifyReply): Promise<void> {
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

    const parsed = SearchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({
          message: 'Invalid query',
          details: parsed.error.errors.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        })
      }));
      return;
    }

    const result = await application.search(parsed.data);

    if (result.kind === 'invalid_query') {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({
          details: result.errors
        })
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      correlationId,
      data: {
        items: result.items.map(toSearchItemDto)
      },
      meta: {
        limit: result.limit,
        offset: result.offset,
        filtered: Boolean(
          parsed.data.q
          || parsed.data.entityType
          || parsed.data.customerId
          || parsed.data.accountId
          || parsed.data.paymentId
          || parsed.data.caseId
          || parsed.data.status
          || parsed.data.correlationId
        )
      }
    }));
  }

  async function getByEntity(request: EntityLookupRequest, reply: FastifyReply): Promise<void> {
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

    const parsedParams = EntityLookupParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({
          details: parsedParams.error.errors.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        })
      }));
      return;
    }

    const result = await application.getByEntity(
      parsedParams.data.entityType,
      parsedParams.data.entityId
    );

    if (result.kind === 'invalid_query') {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({ details: result.errors })
      }));
      return;
    }

    if (result.kind === 'not_found') {
      reply.code(404).send(buildErrorResponse({
        correlationId,
        error: buildNotFoundError('Index record not found')
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      correlationId,
      data: toSearchItemDto(result.item)
    }));
  }

  return {
    search,
    getByEntity
  };
}
