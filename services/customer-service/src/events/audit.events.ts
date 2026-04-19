import { randomUUID } from 'node:crypto';
import type { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';

export type AuditRecord = {
  action: 'customer.create';
  customerId: string;
  idempotencyKey: string;
  timestamp: string;
};

export class AuditEventsService {
  constructor(private readonly kafkaProducer: KafkaProducerAdapter) {}

  async createCustomerAuditRecord(customerId: string, idempotencyKey: string): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'audit.customer.created.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: `customer-${customerId}`,
        causationId: `customer-create-req-${idempotencyKey}`,
        timestamp: new Date().toISOString()
      },
      payload: {
        action: 'customer.create',
        customerId,
        idempotencyKey,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createCustomerOnboardingAuditRecord(input: {
    customerId: string;
    onboardingReference: string;
    sourceEventId: string;
    correlationId: string;
  }): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'audit.customer.onboarding.created.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: input.correlationId,
        causationId: input.sourceEventId,
        timestamp: new Date().toISOString()
      },
      payload: {
        action: 'customer.create.onboarding',
        customerId: input.customerId,
        onboardingReference: input.onboardingReference,
        sourceEventId: input.sourceEventId,
        timestamp: new Date().toISOString()
      }
    });
  }
}
