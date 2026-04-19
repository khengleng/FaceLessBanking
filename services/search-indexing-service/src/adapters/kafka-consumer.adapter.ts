import {
  createEventBackboneConsumer,
  type EventBackboneConsumer,
  type EventEnvelope
} from '@faceless-banking/shared-events';

import type { SupportedIndexEventType } from '../domain/lifecycle-event.js';

export const SEARCH_INDEX_TOPICS: SupportedIndexEventType[] = [
  'customer.created.v1',
  'customer.profile.enriched.v1',
  'account.created.v1',
  'account.activated.v1',
  'payment.initiated.v1',
  'payment.status.updated.v1',
  'case.created.v1',
  'case.action.recorded.v1'
];

type LifecycleEventHandler = (event: unknown) => Promise<void>;

export class KafkaConsumerAdapter {
  private readonly consumer: EventBackboneConsumer;
  private lifecycleEventHandler: LifecycleEventHandler | null = null;

  constructor() {
    this.consumer = createEventBackboneConsumer({
      consumer: 'search-indexing-service-consumer',
      groupId: 'search-indexing-service-group',
      retry: { maxAttempts: 3 },
      dlq: { topic: 'search-indexing-service.consumer.dlq', enabled: true }
    });
  }

  async subscribeLifecycleEvents(handler: LifecycleEventHandler): Promise<void> {
    this.lifecycleEventHandler = handler;
    await this.consumer.subscribe(SEARCH_INDEX_TOPICS);
  }

  async handleLifecycleEvent(event: EventEnvelope<string, Record<string, unknown>> | unknown): Promise<void> {
    if (!this.lifecycleEventHandler) {
      return;
    }

    await this.lifecycleEventHandler(event);
  }

  async start(): Promise<void> {
    await this.consumer.start();
  }
}
