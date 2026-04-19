import { randomUUID } from 'node:crypto';

import type { PostgresAuditAdapter } from '../adapters/postgres-audit.adapter.js';
import { buildAuditEvent, type AuditEvent } from '../domain/audit-event.js';
import type { AuditLifecycleMetrics } from '../events/metrics.js';

export type PaymentLifecycleEventType = 'payment.initiated.v1' | 'payment.status.updated.v1';

type PaymentInitiatedEvent = {
  specVersion: '1.0';
  type: 'payment.initiated.v1';
  version: number;
  metadata: {
    eventId: string;
    correlationId: string;
    causationId?: string;
    timestamp: string;
    producer: string;
  };
  payload: {
    paymentId: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    currency: string;
    channel: string;
  };
};

type PaymentStatusUpdatedEvent = {
  specVersion: '1.0';
  type: 'payment.status.updated.v1';
  version: number;
  metadata: {
    eventId: string;
    correlationId: string;
    causationId?: string;
    timestamp: string;
    producer: string;
  };
  payload: {
    paymentId: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    currency: string;
    previousStatus: string;
    status: string;
    reason: string;
  };
};

export type PaymentLifecycleEvent = PaymentInitiatedEvent | PaymentStatusUpdatedEvent;

export type ProcessLifecycleEventResult =
  | { kind: 'created'; auditEvent: AuditEvent }
  | { kind: 'duplicate' }
  | { kind: 'ignored_event_type' }
  | { kind: 'invalid_event'; reason: string };

export class PaymentAuditEnricherApplication {
  constructor(
    private readonly auditAdapter: PostgresAuditAdapter,
    private readonly metrics: AuditLifecycleMetrics,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async processLifecycleEvent(rawEvent: unknown): Promise<ProcessLifecycleEventResult> {
    const parsed = parsePaymentLifecycleEvent(rawEvent);
    if (!parsed) {
      this.metrics.recordMalformedLifecycleEventRejected();
      return { kind: 'invalid_event', reason: 'invalid_event_envelope' };
    }

    const duplicate = await this.auditAdapter.findAuditBySourceEventId(parsed.metadata.eventId);
    if (duplicate) {
      this.metrics.recordDuplicateAuditEventSkipped();
      this.logger.info(
        {
          sourceEventId: parsed.metadata.eventId,
          correlationId: parsed.metadata.correlationId,
          eventType: parsed.type
        },
        'Skipping duplicate payment lifecycle event for audit enrichment'
      );
      return { kind: 'duplicate' };
    }

    const auditEvent = mapToAuditEvent(parsed);
    await this.auditAdapter.createAuditEvent(auditEvent);
    this.metrics.recordAuditRecordCreated();

    this.logger.info(
      {
        auditId: auditEvent.auditId,
        sourceEventId: auditEvent.sourceEventId,
        correlationId: auditEvent.correlationId,
        eventType: auditEvent.eventType,
        entityId: auditEvent.entityId
      },
      'Created audit record from payment lifecycle event'
    );

    return { kind: 'created', auditEvent };
  }
}

function parsePaymentLifecycleEvent(rawEvent: unknown): PaymentLifecycleEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;

  if (event.specVersion !== '1.0') {
    return null;
  }

  if (event.type !== 'payment.initiated.v1' && event.type !== 'payment.status.updated.v1') {
    return null;
  }

  if (typeof event.version !== 'number') {
    return null;
  }

  const metadata = event.metadata as Record<string, unknown> | undefined;
  const payload = event.payload as Record<string, unknown> | undefined;

  if (!metadata || !payload) {
    return null;
  }

  if (
    typeof metadata.eventId !== 'string'
    || typeof metadata.correlationId !== 'string'
    || typeof metadata.timestamp !== 'string'
    || typeof metadata.producer !== 'string'
  ) {
    return null;
  }

  if (
    typeof payload.paymentId !== 'string'
    || typeof payload.sourceAccountId !== 'string'
    || typeof payload.destinationAccountId !== 'string'
    || typeof payload.amount !== 'number'
    || typeof payload.currency !== 'string'
  ) {
    return null;
  }

  if (event.type === 'payment.initiated.v1' && typeof payload.channel !== 'string') {
    return null;
  }

  if (
    event.type === 'payment.status.updated.v1'
    && (
      typeof payload.previousStatus !== 'string'
      || typeof payload.status !== 'string'
      || typeof payload.reason !== 'string'
    )
  ) {
    return null;
  }

  return event as PaymentLifecycleEvent;
}

function mapToAuditEvent(event: PaymentLifecycleEvent): AuditEvent {
  const now = new Date().toISOString();

  const basePayload: Record<string, unknown> = {
    amount: event.payload.amount,
    currency: event.payload.currency,
    sourceAccountIdMasked: maskAccountId(event.payload.sourceAccountId),
    destinationAccountIdMasked: maskAccountId(event.payload.destinationAccountId)
  };

  const payload = event.type === 'payment.initiated.v1'
    ? {
      ...basePayload,
      channel: event.payload.channel
    }
    : {
      ...basePayload,
      previousStatus: event.payload.previousStatus,
      status: event.payload.status,
      reason: event.payload.reason
    };

  return buildAuditEvent({
    auditId: randomUUID(),
    sourceEventId: event.metadata.eventId,
    correlationId: event.metadata.correlationId,
    eventType: event.type,
    entityType: 'PAYMENT',
    entityId: event.payload.paymentId,
    payload,
    actor: {
      actorId: event.metadata.producer,
      actorType: 'SYSTEM'
    },
    createdAt: now
  });
}

function maskAccountId(accountId: string): string {
  if (accountId.length <= 4) {
    return '****';
  }

  return `****${accountId.slice(-4)}`;
}
