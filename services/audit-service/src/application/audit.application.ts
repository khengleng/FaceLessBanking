import { randomUUID } from 'node:crypto';

import type { PostgresAuditAdapter } from '../adapters/postgres-audit.adapter.js';
import type { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import type { CreateAuditEventRequestDto } from '../controllers/dtos/audit.dto.js';
import { buildAuditEvent, type AuditEvent, verifyAuditEventChecksum } from '../domain/audit-event.js';

export type CreateAuditEventResult =
  | { kind: 'created'; event: AuditEvent }
  | { kind: 'invalid_payload'; errors: string[] };

export type GetAuditEventResult =
  | { kind: 'found'; event: AuditEvent }
  | { kind: 'not_found' };

export type QueryAuditEventsResult =
  | { kind: 'found'; events: AuditEvent[] }
  | { kind: 'invalid_query'; errors: string[] };

export type VerifyAuditEventChecksumResult =
  | { kind: 'verified'; auditId: string; checksumValid: boolean }
  | { kind: 'not_found' };

export class AuditApplication {
  constructor(
    private readonly postgresAdapter: PostgresAuditAdapter,
    private readonly kafkaProducer?: KafkaProducerAdapter
  ) {}

  async createEvent(payload: CreateAuditEventRequestDto): Promise<CreateAuditEventResult> {
    const errors = validateCreatePayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const event = buildAuditEvent({
      auditId: randomUUID(),
      // Manual API writes are treated as first-class source events for append-only traceability.
      sourceEventId: payload.sourceEventId ?? randomUUID(),
      eventType: payload.eventType,
      correlationId: payload.correlationId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      payload: payload.payload,
      createdAt: payload.timestamp ?? new Date().toISOString(),
      actor: {
        actorId: payload.actor.actorId,
        actorType: payload.actor.actorType
      }
    });

    await this.postgresAdapter.createAuditEvent(event);
    await this.kafkaProducer?.publishAuditHardenedRecorded(event);

    return { kind: 'created', event };
  }

  async getEventById(eventId: string): Promise<GetAuditEventResult> {
    const event = await this.postgresAdapter.findEventById(eventId);

    if (!event) {
      return { kind: 'not_found' };
    }

    return { kind: 'found', event };
  }

  async queryEvents(
    input: {
      entityType?: string;
      entityId?: string;
      correlationId?: string;
      sourceEventId?: string;
    }
  ): Promise<QueryAuditEventsResult> {
    const errors = validateQuery(input.entityType, input.entityId, input.correlationId, input.sourceEventId);
    if (errors.length > 0) {
      return { kind: 'invalid_query', errors };
    }

    const events = input.sourceEventId
      ? await this.postgresAdapter.getAuditBySourceEventId(input.sourceEventId)
      : input.correlationId
        ? await this.postgresAdapter.getAuditByCorrelationId(input.correlationId)
        : await this.postgresAdapter.getAuditByEntityId(input.entityType!, input.entityId!);

    return { kind: 'found', events };
  }

  async verifyEventChecksum(eventId: string): Promise<VerifyAuditEventChecksumResult> {
    const event = await this.postgresAdapter.findEventById(eventId);
    if (!event) {
      return { kind: 'not_found' };
    }

    return {
      kind: 'verified',
      auditId: event.auditId,
      checksumValid: verifyAuditEventChecksum(event)
    };
  }
}

function validateCreatePayload(payload: CreateAuditEventRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.eventType || payload.eventType.trim().length < 3) {
    errors.push('eventType must contain at least 3 characters');
  }

  if (!payload.correlationId || payload.correlationId.trim().length < 3) {
    errors.push('correlationId must contain at least 3 characters');
  }

  if (!payload.entityType || payload.entityType.trim().length < 2) {
    errors.push('entityType must contain at least 2 characters');
  }

  if (!payload.entityId || payload.entityId.trim().length < 2) {
    errors.push('entityId must contain at least 2 characters');
  }

  if (!payload.payload || typeof payload.payload !== 'object' || Array.isArray(payload.payload)) {
    errors.push('payload must be an object');
  }

  if (!payload.actor || typeof payload.actor !== 'object') {
    errors.push('actor is required');
  } else {
    if (!payload.actor.actorId || payload.actor.actorId.trim().length < 2) {
      errors.push('actor.actorId must contain at least 2 characters');
    }

    if (!payload.actor.actorType || payload.actor.actorType.trim().length < 2) {
      errors.push('actor.actorType must contain at least 2 characters');
    }
  }

  return errors;
}

function validateQuery(
  entityType: string | undefined,
  entityId: string | undefined,
  correlationId: string | undefined,
  sourceEventId: string | undefined
): string[] {
  const errors: string[] = [];

  if (sourceEventId && sourceEventId.trim().length >= 3) {
    return errors;
  }

  if (correlationId && correlationId.trim().length >= 3) {
    return errors;
  }

  if (!entityType || entityType.trim().length < 2) {
    errors.push('entityType query param is required when correlationId is not provided');
  }

  if (!entityId || entityId.trim().length < 2) {
    errors.push('entityId query param is required when correlationId is not provided');
  }

  return errors;
}
