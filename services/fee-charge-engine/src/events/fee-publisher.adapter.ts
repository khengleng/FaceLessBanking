import type { Producer } from 'kafkajs';
import { randomUUID } from 'node:crypto';
import type { FeeAssessment } from '../domain/fee-assessment.js';

export class FeeEventsPublisher {
  private readonly topic = 'fee.assessed.v1';

  constructor(
    private readonly producer: Producer,
    private readonly source: string = 'fee-charge-engine'
  ) {}

  async emitFeeAssessed(assessment: FeeAssessment, correlationId?: string): Promise<void> {
    const event = {
      specVersion: '1.0',
      type: 'fee.assessed.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: correlationId || randomUUID(),
        timestamp: new Date().toISOString(),
        producer: this.source
      },
      payload: {
        assessmentId: assessment.assessmentId,
        sourceEventId: assessment.sourceEventId,
        sourceEntityType: assessment.sourceEntityType,
        sourceEntityId: assessment.sourceEntityId,
        ruleId: assessment.ruleId,
        assessedAmountCents: assessment.assessedAmountCents,
        currency: assessment.currency,
        timestamp: assessment.createdAt
      }
    };

    await this.producer.send({
      topic: this.topic,
      messages: [{ 
        key: assessment.sourceEntityId,
        value: JSON.stringify(event) 
      }]
    });
  }

  async emitFeeCollected(assessment: FeeAssessment, correlationId?: string): Promise<void> {
    const event = {
      specVersion: '1.0',
      type: 'fee.collected.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: correlationId || randomUUID(),
        timestamp: new Date().toISOString(),
        producer: this.source
      },
      payload: {
        assessmentId: assessment.assessmentId,
        paymentId: assessment.paymentId,
        assessedAmountCents: assessment.assessedAmountCents,
        currency: assessment.currency,
        timestamp: new Date().toISOString()
      }
    };

    await this.producer.send({
      topic: 'fee.collected.v1',
      messages: [{ key: assessment.assessmentId, value: JSON.stringify(event) }]
    });
  }

  async emitFeeFailed(assessment: FeeAssessment, reason: string, correlationId?: string): Promise<void> {
    const event = {
      specVersion: '1.0',
      type: 'fee.failed.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: correlationId || randomUUID(),
        timestamp: new Date().toISOString(),
        producer: this.source
      },
      payload: {
        assessmentId: assessment.assessmentId,
        reason,
        timestamp: new Date().toISOString()
      }
    };

    await this.producer.send({
      topic: 'fee.failed.v1',
      messages: [{ key: assessment.assessmentId, value: JSON.stringify(event) }]
    });
  }
}
