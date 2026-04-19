import type { PricingEventMetrics } from './metrics.js';

export type PricingEvent = {
  eventName: string;
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export interface PricingEventPublisherAdapter {
  publish(event: PricingEvent): Promise<void>;
}

export class PricingEventsPublisher {
  constructor(
    private readonly adapter: PricingEventPublisherAdapter,
    private readonly metrics: PricingEventMetrics
  ) {}

  async publish(event: PricingEvent): Promise<void> {
    try {
      await this.adapter.publish(event);
      this.metrics.published += 1;
    } catch {
      this.metrics.failed += 1;
      throw new Error('Failed to publish pricing event');
    }
  }
}
