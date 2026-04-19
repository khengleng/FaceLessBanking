import type { NiiEventMetrics } from './metrics.js';

export type NiiSensitivityEvent = {
  eventName: string;
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export interface NiiEventPublisherAdapter {
  publish(event: NiiSensitivityEvent): Promise<void>;
}

export class NiiEventsPublisher {
  constructor(
    private readonly adapter: NiiEventPublisherAdapter,
    private readonly metrics: NiiEventMetrics
  ) {}

  async publish(event: NiiSensitivityEvent): Promise<void> {
    try {
      await this.adapter.publish(event);
      this.metrics.published += 1;
    } catch {
      this.metrics.failed += 1;
      throw new Error('Failed to publish NII sensitivity event');
    }
  }
}
