import {
  type EventEnvelope,
  createEventBackboneProducer,
  type EventBackboneProducer
} from '@faceless-banking/shared-events';

export type PaymentInitiatedPayload = {
  paymentId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
  channel: string;
};

export type PaymentStatusUpdatedPayload = {
  paymentId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
  previousStatus: string;
  status: string;
  reason: string;
};

export type PaymentInitiatedEvent = EventEnvelope<'payment.initiated.v1', PaymentInitiatedPayload>;
export type PaymentStatusUpdatedEvent = EventEnvelope<'payment.status.updated.v1', PaymentStatusUpdatedPayload>;

export class KafkaProducerAdapter {
  private readonly producer: EventBackboneProducer;

  public readonly failPublish: boolean;

  constructor(config?: { failPublish?: boolean }) {
    this.failPublish = config?.failPublish ?? false;
    this.producer = createEventBackboneProducer({
      producer: 'payment-orchestration',
      retry: { maxAttempts: 2 },
      dlq: { topic: 'payment-orchestration.events.dlq', enabled: true }
    });
  }

  get events(): Array<EventEnvelope<string, Record<string, unknown>>> {
    return this.producer.publishedEvents;
  }

  get dlqEvents(): Array<EventEnvelope<string, Record<string, unknown>>> {
    return this.producer.dlqEvents;
  }

  async publishPaymentInitiated(event: PaymentInitiatedEvent): Promise<{ published: boolean }> {
    return this.publish(event);
  }

  async publishPaymentStatusUpdated(event: PaymentStatusUpdatedEvent): Promise<{ published: boolean }> {
    return this.publish(event);
  }

  private async publish(event: EventEnvelope<string, Record<string, unknown>>): Promise<{ published: boolean }> {
    if (this.failPublish) {
      return { published: false };
    }

    const result = await this.producer.publish({
      type: event.type,
      version: event.version,
      metadata: {
        eventId: event.metadata.eventId,
        correlationId: event.metadata.correlationId,
        causationId: event.metadata.causationId,
        timestamp: event.metadata.timestamp
      },
      payload: event.payload
    });

    return { published: result.published };
  }
}
