import type { FxExposureEventMetrics } from './metrics.js';

export type FxExposureEvent = {
  eventName: string;
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export interface FxExposureEventPublisherAdapter {
  publish(event: FxExposureEvent): Promise<void>;
}

export class FxExposureEventsPublisher {
  constructor(
    private readonly adapter: FxExposureEventPublisherAdapter,
    private readonly metrics: FxExposureEventMetrics
  ) {}

  async publish(event: FxExposureEvent): Promise<void> {
    try {
      await this.adapter.publish(event);
      this.metrics.published += 1;
    } catch {
      this.metrics.failed += 1;
      throw new Error('Failed to publish FX exposure event');
    }
  }
}
