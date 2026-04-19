import type { AuditEvent } from '../../domain/audit-event.js';

export type CreateAuditEventRequestDto = {
  sourceEventId?: string;
  eventType: string;
  correlationId: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  timestamp?: string;
  actor: {
    actorId: string;
    actorType: string;
  };
};

export type AuditEventResponseDto = {
  auditId: string;
  sourceEventId: string;
  eventId: string;
  eventType: string;
  correlationId: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  checksum: string;
  createdAt: string;
  timestamp: string;
  actor: {
    actorId: string;
    actorType: string;
  };
};

export function toAuditEventResponseDto(event: AuditEvent): AuditEventResponseDto {
  const actor = event.actor ?? {
    actorId: 'unknown',
    actorType: 'unknown'
  };

  return {
    auditId: event.auditId,
    sourceEventId: event.sourceEventId,
    eventId: event.eventId,
    eventType: event.eventType,
    correlationId: event.correlationId,
    entityType: event.entityType,
    entityId: event.entityId,
    payload: event.payload,
    checksum: event.checksum,
    createdAt: event.createdAt,
    timestamp: event.timestamp,
    actor: {
      actorId: actor.actorId,
      actorType: actor.actorType
    }
  };
}
