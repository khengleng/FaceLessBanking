import type { Producer } from 'kafkajs';
import { randomUUID } from 'node:crypto';

export class LimitsEventsPublisher {
  constructor(
    private readonly producer: Producer,
    private readonly source: string = 'limits-engine'
  ) {}

  async emitLimitDecision(params: {
    decision: string;
    entityId: string;
    amountCents: bigint;
    currency: string;
    ruleId?: string;
    correlationId?: string;
  }): Promise<void> {
    const type = `limit.${params.decision.toLowerCase()}.v1`;
    const event = {
      specVersion: '1.0',
      type,
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: params.correlationId || randomUUID(),
        timestamp: new Date().toISOString(),
        producer: this.source
      },
      payload: {
        decision: params.decision,
        entityId: params.entityId,
        amountCents: params.amountCents.toString(),
        currency: params.currency,
        ruleId: params.ruleId
      }
    };

    await this.producer.send({
      topic: 'limit.decisions.v1',
      messages: [{ key: params.entityId, value: JSON.stringify(event) }]
    });
  }
}
