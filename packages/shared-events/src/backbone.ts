import { randomUUID } from 'node:crypto';

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
  retry: RetryConfig;
  dlq: DlqConfig;
};

export type EventPublishResult = {
  published: boolean;
  attempts: number;
  sentToDlq: boolean;
};

export interface EventBackboneTransport {
  send(event: EventEnvelope<string, Record<string, unknown>>): Promise<void>;
}

class InMemoryEventTransport implements EventBackboneTransport {
  constructor(private readonly sink: EventEnvelope<string, Record<string, unknown>>[]) {}

  async send(event: EventEnvelope<string, Record<string, unknown>>): Promise<void> {
    this.sink.push(event);
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
    this.transport = transport ?? new InMemoryEventTransport(this.publishedEvents);
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
        void error;
      }
    }

    if (this.config.dlq.enabled) {
      this.dlqEvents.push(event);
    }

    return {
      published: false,
      attempts: maxAttempts,
      sentToDlq: this.config.dlq.enabled
    };
  }

  getConfig(): EventBackboneProducerConfig {
    return this.config;
  }
}

export type EventBackboneConsumerConfig = {
  consumer: string;
  groupId: string;
  retry: RetryConfig;
  dlq: DlqConfig;
};

export class EventBackboneConsumer {
  public readonly subscriptions: string[] = [];

  constructor(private readonly _config: EventBackboneConsumerConfig) {}

  async subscribe(topics: string[]): Promise<void> {
    for (const topic of topics) {
      if (!this.subscriptions.includes(topic)) {
        this.subscriptions.push(topic);
      }
    }
  }

  async start(): Promise<void> {
    // TODO: attach real broker consumer polling/handlers.
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
