import { createEventBackboneProducer, type EventBackboneProducer } from '@faceless-banking/shared-events';

import type { AuditEvent } from '../domain/audit-event.js';

export class KafkaProducerAdapter {
  private readonly producer: EventBackboneProducer;

  constructor() {
    this.producer = createEventBackboneProducer({
      producer: 'audit-service',
      retry: { maxAttempts: 3 },
      dlq: { topic: 'audit-service.producer.dlq', enabled: true }
    });
  }

  async publishAuditHardenedRecorded(event: AuditEvent): Promise<void> {
    await this.producer.publish({
      type: 'audit.hardened.recorded.v1',
      metadata: {
        correlationId: event.correlationId,
        causationId: event.sourceEventId
      },
      payload: {
        auditId: event.auditId,
        sourceEventId: event.sourceEventId,
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        checksum: event.checksum,
        createdAt: event.createdAt
      }
    });
  }
}
