import {
  createEventBackboneProducer,
  type EventBackboneProducer,
  type EventPublishInput,
  type EventPublishResult,
  type EventEnvelope
} from '@faceless-banking/shared-events';

export type PublishedEvent = EventEnvelope<string, Record<string, unknown>>;

export class KafkaProducerAdapter {
  private readonly producer: EventBackboneProducer;

  constructor() {
    this.producer = createEventBackboneProducer({
      producer: 'loan-orchestration',
      retry: { maxAttempts: 2 },
      dlq: { topic: 'loan-orchestration.events.dlq', enabled: true }
    });
  }

  get events(): PublishedEvent[] {
    return this.producer.publishedEvents;
  }

  get dlqEvents(): PublishedEvent[] {
    return this.producer.dlqEvents;
  }

  async publish(input: EventPublishInput): Promise<EventPublishResult> {
    return this.producer.publish(input);
  }
}
