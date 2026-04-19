import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuditApplication } from '../application/audit.application.js';
import type { CreateAuditEventRequestDto } from './dtos/audit.dto.js';
import { toAuditEventResponseDto } from './dtos/audit.dto.js';

type CreateAuditRequest = FastifyRequest<{ Body: CreateAuditEventRequestDto }>;
type GetAuditByIdRequest = FastifyRequest<{ Params: { eventId: string } }>;
type QueryAuditRequest = FastifyRequest<{
  Querystring: {
    entityType?: string;
    entityId?: string;
    correlationId?: string;
    sourceEventId?: string;
  };
}>;

export function buildAuditController(auditApplication: AuditApplication) {
  async function createAuditEvent(
    request: CreateAuditRequest,
    reply: FastifyReply
  ): Promise<void> {
    const result = await auditApplication.createEvent(request.body);

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    reply.code(201).send(toAuditEventResponseDto(result.event));
  }

  async function getAuditEventById(
    request: GetAuditByIdRequest,
    reply: FastifyReply
  ): Promise<void> {
    const result = await auditApplication.getEventById(request.params.eventId);

    if (result.kind === 'not_found') {
      reply.code(404).send({ error: 'audit_event_not_found' });
      return;
    }

    reply.code(200).send(toAuditEventResponseDto(result.event));
  }

  async function queryAuditEvents(
    request: QueryAuditRequest,
    reply: FastifyReply
  ): Promise<void> {
    const result = await auditApplication.queryEvents({
      entityType: request.query.entityType,
      entityId: request.query.entityId,
      correlationId: request.query.correlationId,
      sourceEventId: request.query.sourceEventId
    });

    if (result.kind === 'invalid_query') {
      reply.code(400).send({
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    reply.code(200).send({
      items: result.events.map(toAuditEventResponseDto)
    });
  }

  return {
    createAuditEvent,
    getAuditEventById,
    queryAuditEvents
  };
}
