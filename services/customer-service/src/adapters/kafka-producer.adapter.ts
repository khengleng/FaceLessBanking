import { Kafka, type Producer } from 'kafkajs';
import {
  createEventBackboneProducer,
  type EventBackboneProducer,
  type EventPublishInput,
  type EventPublishResult,
  type EventEnvelope,
  type EventBackboneTransport
} from '@faceless-banking/shared-events';

export type PublishedEvent = EventEnvelope<string, Record<string, unknown>>;

export class KafkaEventTransport implements EventBackboneTransport {
  private readonly producer: Producer;

  constructor(brokers: string[]) {
    const kafka = new Kafka({ brokers });
    this.producer = kafka.producer();
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async send(event: EventEnvelope<string, Record<string, unknown>>): Promise<void> {
    await this.producer.send({
      topic: event.type,
      messages: [{ value: JSON.stringify(event) }]
    });
  }
}

export class KafkaProducerAdapter {
  private readonly producer: EventBackboneProducer;

  constructor(transport?: EventBackboneTransport) {
    this.producer = createEventBackboneProducer({
      producer: 'customer-service',
      retry: { maxAttempts: 2 },
      dlq: { topic: 'customer-service.events.dlq', enabled: true }
    }, transport);
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

