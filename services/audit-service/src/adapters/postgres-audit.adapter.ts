import type { AuditEvent } from '../domain/audit-event.js';

export class ImmutableAuditLogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImmutableAuditLogError';
  }
}

export class PostgresAuditAdapter {
  private readonly eventsByAuditId = new Map<string, AuditEvent>();

  private readonly sourceEventToAuditId = new Map<string, string>();

  async createAuditEvent(event: AuditEvent): Promise<void> {
    if (this.eventsByAuditId.has(event.auditId)) {
      throw new ImmutableAuditLogError(
        `Audit event with auditId "${event.auditId}" already exists and cannot be overwritten`
      );
    }

    const existingAuditId = this.sourceEventToAuditId.get(event.sourceEventId);
    if (existingAuditId && existingAuditId !== event.auditId) {
      throw new ImmutableAuditLogError(
        `Audit event with sourceEventId "${event.sourceEventId}" already exists and cannot be overwritten`
      );
    }

    // Append-oriented immutable placeholder store.
    const immutableEvent = freezeAuditEvent(event);
    this.eventsByAuditId.set(immutableEvent.auditId, immutableEvent);
    this.sourceEventToAuditId.set(immutableEvent.sourceEventId, immutableEvent.auditId);
  }

  async findEventById(eventId: string): Promise<AuditEvent | null> {
    const event = this.eventsByAuditId.get(eventId);
    if (!event) {
      return null;
    }

    return cloneAuditEvent(event);
  }

  async findAuditBySourceEventId(sourceEventId: string): Promise<AuditEvent | null> {
    const auditId = this.sourceEventToAuditId.get(sourceEventId);
    if (!auditId) {
      return null;
    }

    const event = this.eventsByAuditId.get(auditId);
    if (!event) {
      return null;
    }

    return cloneAuditEvent(event);
  }

  async getAuditByEntityId(entityType: string, entityId: string): Promise<AuditEvent[]> {
    return Array.from(this.eventsByAuditId.values())
      .filter((event) => event.entityType === entityType && event.entityId === entityId)
      .map(cloneAuditEvent);
  }

  async getAuditByCorrelationId(correlationId: string): Promise<AuditEvent[]> {
    return Array.from(this.eventsByAuditId.values())
      .filter((event) => event.correlationId === correlationId)
      .map(cloneAuditEvent);
  }

  async getAuditBySourceEventId(sourceEventId: string): Promise<AuditEvent[]> {
    const event = await this.findAuditBySourceEventId(sourceEventId);
    return event ? [event] : [];
  }

  async appendEvent(event: AuditEvent): Promise<void> {
    await this.createAuditEvent(event);
  }

  async findEventsByEntity(entityType: string, entityId: string): Promise<AuditEvent[]> {
    return this.getAuditByEntityId(entityType, entityId);
  }
}

function freezeAuditEvent(event: AuditEvent): AuditEvent {
  const cloned = cloneAuditEvent(event);
  return deepFreeze(cloned);
}

function cloneAuditEvent(event: AuditEvent): AuditEvent {
  return structuredClone(event);
}

function deepFreeze<T>(input: T): T {
  if (!input || typeof input !== 'object') {
    return input;
  }

  for (const key of Object.keys(input as Record<string, unknown>)) {
    const value = (input as Record<string, unknown>)[key];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  return Object.freeze(input);
}
