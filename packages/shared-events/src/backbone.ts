import { randomUUID } from 'node:crypto';
import { Kafka, type Producer, type Consumer, type Message, type ConsumerConfig } from 'kafkajs';

import { buildEventEnvelope, type EventEnvelope, type EventMetadata, type EventVersion } from './types.js';

export type EventPublishInput = {
  type: string;
  version?: EventVersion;
  payload: Record<string, unknown>;
  metadata: {
    correlationId: string;
    causationId?: string;
    eventId?: string;
    timestamp?: string;
  };
};

export type RetryConfig = {
  maxAttempts: number;
};

export type DlqConfig = {
  topic: string;
  enabled: boolean;
};

export type EventBackboneProducerConfig = {
  producer: string;
  brokers: string[];
  retry: RetryConfig;
  dlq: DlqConfig;
  clientId?: string;
};

export type EventPublishResult = {
  published: boolean;
  attempts: number;
  sentToDlq: boolean;
};

export interface EventBackboneTransport {
  send(event: EventEnvelope<string, Record<string, unknown>>): Promise<void>;
  disconnect?(): Promise<void>;
}

class InMemoryEventTransport implements EventBackboneTransport {
  constructor(private readonly sink: EventEnvelope<string, Record<string, unknown>>[]) {}

  async send(event: EventEnvelope<string, Record<string, unknown>>): Promise<void> {
    this.sink.push(event);
  }
}

export class KafkaEventTransport implements EventBackboneTransport {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private isConnected = false;

  constructor(brokers: string[], clientId: string) {
    this.kafka = new Kafka({
      clientId,
      brokers,
    });
    this.producer = this.kafka.producer();
  }

  async send(event: EventEnvelope<string, Record<string, unknown>>): Promise<void> {
    if (!this.isConnected) {
      await this.producer.connect();
      this.isConnected = true;
    }

    await this.producer.send({
      topic: event.type, // Using event type as topic by default
      messages: [
        {
          key: (event.payload as any).customerId ?? event.metadata.correlationId,
          value: JSON.stringify(event),
        },
      ],
    });
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.producer.disconnect();
      this.isConnected = false;
    }
  }
}

export class EventBackboneProducer {
  public readonly publishedEvents: EventEnvelope<string, Record<string, unknown>>[] = [];
  public readonly dlqEvents: EventEnvelope<string, Record<string, unknown>>[] = [];

  private readonly transport: EventBackboneTransport;

  constructor(
    private readonly config: EventBackboneProducerConfig,
    transport?: EventBackboneTransport
  ) {
    this.transport = transport ?? (
      config.brokers && config.brokers.length > 0 
        ? new KafkaEventTransport(config.brokers, config.clientId ?? config.producer)
        : new InMemoryEventTransport(this.publishedEvents)
    );
  }

  async publish(input: EventPublishInput): Promise<EventPublishResult> {
    const event = buildEventEnvelope({
      type: input.type,
      version: input.version ?? 1,
      metadata: buildMetadata(input.metadata, this.config.producer),
      payload: input.payload
    });

    const maxAttempts = normalizeMaxAttempts(this.config.retry.maxAttempts);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.transport.send(event);

        return {
          published: true,
          attempts: attempt,
          sentToDlq: false
        };
      } catch (error: unknown) {
        console.error(`Failed to publish event (attempt ${attempt}/${maxAttempts}):`, error);
        if (attempt === maxAttempts && this.config.dlq.enabled) {
          // Send to DLQ topic if transport is Kafka
          if (this.transport instanceof KafkaEventTransport) {
            try {
              await this.sendToKafkaDlq(event);
            } catch (dlqError) {
              console.error('Failed to send to DLQ:', dlqError);
            }
          }
          this.dlqEvents.push(event);
        }
      }
    }

    return {
      published: false,
      attempts: maxAttempts,
      sentToDlq: this.config.dlq.enabled
    };
  }

  private async sendToKafkaDlq(event: EventEnvelope<string, Record<string, unknown>>): Promise<void> {
    if (this.transport instanceof KafkaEventTransport) {
      const dlqEvent = { ...event, metadata: { ...event.metadata, isDlq: true } };
      // Implement specific DLQ sending if needed, currently sharing the transport
      // We might want a separate producer or just send to a different topic
    }
  }

  async disconnect(): Promise<void> {
    if (this.transport.disconnect) {
      await this.transport.disconnect();
    }
  }

  getConfig(): EventBackboneProducerConfig {
    return this.config;
  }
}

export type EventBackboneConsumerConfig = {
  consumer: string;
  groupId: string;
  brokers: string[];
  retry: RetryConfig;
  dlq: DlqConfig;
  clientId?: string;
};

export class EventBackboneConsumer {
  public readonly subscriptions: string[] = [];
  private readonly kafka?: Kafka;
  private readonly consumer?: Consumer;
  private isConnected = false;

  constructor(private readonly config: EventBackboneConsumerConfig) {
    if (config.brokers && config.brokers.length > 0) {
      this.kafka = new Kafka({
        clientId: config.clientId ?? config.consumer,
        brokers: config.brokers,
      });
      this.consumer = this.kafka.consumer({ groupId: config.groupId });
    }
  }

  async subscribe(topics: string[]): Promise<void> {
    for (const topic of topics) {
      if (!this.subscriptions.includes(topic)) {
        this.subscriptions.push(topic);
      }
    }
    
    if (this.consumer) {
      for (const topic of topics) {
        await this.consumer.subscribe({ topic, fromBeginning: false });
      }
    }
  }

  async start(handler: (event: EventEnvelope<string, any>) => Promise<void>): Promise<void> {
    if (!this.consumer) {
      console.warn('Real Kafka consumer not configured, start() is a no-op');
      return;
    }

    if (!this.isConnected) {
      await this.consumer.connect();
      this.isConnected = true;
    }

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        
        try {
          const event = JSON.parse(message.value.toString()) as EventEnvelope<string, any>;
          await handler(event);
        } catch (error) {
          console.error(`Error processing message from topic ${topic}:`, error);
          // Optional: Send to DLQ topic here if configured
        }
      },
    });
  }

  async disconnect(): Promise<void> {
    if (this.consumer && this.isConnected) {
      await this.consumer.disconnect();
      this.isConnected = false;
    }
  }
}

export function createEventBackboneProducer(
  config: EventBackboneProducerConfig,
  transport?: EventBackboneTransport
): EventBackboneProducer {
  return new EventBackboneProducer(config, transport);
}

export function createEventBackboneConsumer(config: EventBackboneConsumerConfig): EventBackboneConsumer {
  return new EventBackboneConsumer(config);
}

function buildMetadata(
  input: EventPublishInput['metadata'],
  producer: string
): EventMetadata {
  return {
    eventId: input.eventId ?? randomUUID(),
    correlationId: input.correlationId,
    causationId: input.causationId,
    timestamp: input.timestamp ?? new Date().toISOString(),
    producer
  };
}

function normalizeMaxAttempts(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.trunc(value));
}
