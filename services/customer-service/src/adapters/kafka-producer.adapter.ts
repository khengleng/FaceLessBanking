import {
  createEventBackboneProducer,
  type EventBackboneProducer,
  type EventPublishInput,
  type EventPublishResult,
  type EventEnvelope,
} from '@faceless-banking/shared-events';

export type PublishedEvent = EventEnvelope<string, Record<string, unknown>>;

export class KafkaProducerAdapter {
  private readonly producer: EventBackboneProducer;

  constructor() {
    const brokers = process.env.KAFKA_BOOTSTRAP_SERVERS?.split(',') ?? [];
    this.producer = createEventBackboneProducer({
      producer: 'customer-service',
      brokers,
      retry: { maxAttempts: 3 },
      dlq: { topic: 'customer-service.events.dlq', enabled: true }
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

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }
}
