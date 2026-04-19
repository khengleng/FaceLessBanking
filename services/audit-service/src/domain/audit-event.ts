import { createHash } from 'node:crypto';

export type AuditActor = {
  actorId: string;
  actorType: string;
};

export type AuditEvent = {
  auditId: string;
  sourceEventId: string;
  // Backward-compatible alias retained for existing API response/tests.
  eventId: string;
  eventType: string;
  correlationId: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  checksum: string;
  createdAt: string;
  // Backward-compatible alias retained for existing API response/tests.
  timestamp: string;
  actor?: AuditActor;
  // Future ledger anchoring support.
  ledgerAnchorHash?: string;
  ledgerAnchorTxId?: string;
};

export type NewAuditEvent = {
  auditId: string;
  sourceEventId: string;
  eventType: string;
  correlationId: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  checksum?: string;
  createdAt: string;
  actor?: AuditActor;
};

export function buildAuditEvent(input: NewAuditEvent): AuditEvent {
  const sanitizedPayload = sanitizePayload(input.payload);

  return {
    auditId: input.auditId,
    sourceEventId: input.sourceEventId,
    eventId: input.auditId,
    eventType: input.eventType,
    correlationId: input.correlationId,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: sanitizedPayload,
    checksum:
      input.checksum ??
      computeAuditChecksum({
        sourceEventId: input.sourceEventId,
        correlationId: input.correlationId,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        payload: sanitizedPayload,
        createdAt: input.createdAt,
        actor: input.actor
      }),
    createdAt: input.createdAt,
    timestamp: input.createdAt,
    actor: input.actor
  };
}

export function verifyAuditEventChecksum(event: AuditEvent): boolean {
  const expected = computeAuditChecksum({
    sourceEventId: event.sourceEventId,
    correlationId: event.correlationId,
    eventType: event.eventType,
    entityType: event.entityType,
    entityId: event.entityId,
    payload: event.payload,
    createdAt: event.createdAt,
    actor: event.actor
  });

  return expected === event.checksum;
}

type ChecksumInput = {
  sourceEventId: string;
  correlationId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  actor?: AuditActor;
};

function computeAuditChecksum(input: ChecksumInput): string {
  const canonical = stableStringify({
    sourceEventId: input.sourceEventId,
    correlationId: input.correlationId,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload,
    createdAt: input.createdAt,
    actor: input.actor ?? null
  });

  return createHash('sha256').update(canonical).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(payload) as Record<string, unknown>;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        next[key] = '[REDACTED]';
        continue;
      }
      next[key] = sanitizeValue(nested);
    }
    return next;
  }

  return value;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.includes('password') || normalized.includes('token') || normalized.includes('secret');
}
