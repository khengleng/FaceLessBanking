import {
  createEventBackboneProducer,
  type EventBackboneProducer,
  type EventEnvelope
} from '@faceless-banking/shared-events';

export type PublishedEvent = EventEnvelope<string, Record<string, unknown>>;

export class KafkaProducerAdapter {
  private readonly producer: EventBackboneProducer;

  constructor() {
    this.producer = createEventBackboneProducer({
      producer: 'notification-service',
      retry: { maxAttempts: 2 },
      dlq: { topic: 'notification-service.events.dlq', enabled: true }
    });
  }

  get events(): PublishedEvent[] {
    return this.producer.publishedEvents;
  }

  async publish(topic: string, payload: Record<string, unknown>): Promise<void> {
    await this.producer.publish({
      type: topic,
      version: 1,
      metadata: {
        correlationId: String(payload.correlationId ?? 'notification-service-correlation-id')
      },
      payload
    });
  }

  async publishNotificationRequested(
    event: EventEnvelope<'notification.requested.v1', Record<string, unknown>>
  ): Promise<{ published: boolean }> {
    const result = await this.producer.publish({
      type: event.type,
      version: event.version,
      metadata: {
        correlationId: event.metadata.correlationId,
        causationId: event.metadata.causationId,
        eventId: event.metadata.eventId,
        timestamp: event.metadata.timestamp
      },
      payload: event.payload
    });

    return { published: result.published };
  }

  async publishNotificationSent(event: EventEnvelope<string, Record<string, unknown>>): Promise<void> {
    await this.producer.publish({
      type: event.type,
      version: event.version,
      metadata: {
        correlationId: event.metadata.correlationId,
        causationId: event.metadata.causationId,
        eventId: event.metadata.eventId,
        timestamp: event.metadata.timestamp
      },
      payload: event.payload
    });
  }

  async publishNotificationFailed(event: EventEnvelope<string, Record<string, unknown>>): Promise<void> {
    await this.producer.publish({
      type: event.type,
      version: event.version,
      metadata: {
        correlationId: event.metadata.correlationId,
        causationId: event.metadata.causationId,
        eventId: event.metadata.eventId,
        timestamp: event.metadata.timestamp
      },
      payload: event.payload
    });
  }
}
