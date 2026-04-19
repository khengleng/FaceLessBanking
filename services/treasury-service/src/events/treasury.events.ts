import type { TreasuryEventMetrics } from './metrics.js';

export type TreasuryEvent = {
  eventName: string;
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export interface TreasuryEventPublisherAdapter {
  publish(event: TreasuryEvent): Promise<void>;
}

export class TreasuryEventsPublisher {
  constructor(
    private readonly adapter: TreasuryEventPublisherAdapter,
    private readonly metrics: TreasuryEventMetrics
  ) {}

  async publish(event: TreasuryEvent): Promise<void> {
    try {
      await this.adapter.publish(event);
      this.metrics.published += 1;
    } catch {
      this.metrics.failed += 1;
      throw new Error('Failed to publish treasury event');
    }
  }
}
