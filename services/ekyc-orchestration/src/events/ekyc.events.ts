import { randomUUID } from 'node:crypto';

import type { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import type { EkycSession } from '../domain/ekyc-session.js';

export class EkycEventsPublisher {
  constructor(private readonly kafkaProducer: KafkaProducerAdapter) {}

  async emitSessionCreated(session: EkycSession): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'ekyc.session.created.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: `ekyc-session-${session.sessionId}`,
        causationId: `ekyc-session-created-${session.sessionId}`,
        timestamp: new Date().toISOString()
      },
      payload: {
        sessionId: session.sessionId,
        customerId: session.customerId,
        status: session.status
      }
    });
  }

  async emitStatusUpdated(session: EkycSession): Promise<void> {
    await this.emitStatusUpdatedFromWebhook({
      session,
      newStatus: session.status
    });
  }

  async emitStatusUpdatedFromWebhook(input: {
    session: EkycSession;
    oldStatus?: string;
    newStatus: string;
    correlationId?: string;
    reviewResult?: string;
    timestamp?: string;
  }): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'ekyc.status.updated.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: input.correlationId ?? `ekyc-status-${input.session.sessionId}`,
        causationId: `ekyc-status-updated-${input.session.sessionId}`,
        timestamp: input.timestamp ?? new Date().toISOString()
      },
      payload: {
        sessionId: input.session.sessionId,
        customerId: input.session.customerId,
        sumsubApplicantId: input.session.sumsubApplicantId,
        provider: input.session.provider,
        oldStatus: input.oldStatus,
        newStatus: input.newStatus,
        status: input.newStatus,
        reviewResult: input.reviewResult ?? input.session.reviewResult
      }
    });
  }
}
