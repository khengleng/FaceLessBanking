import type { IrrEventMetrics } from './metrics.js';

export type IrrScenarioEvent = {
  eventName: string;
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export interface IrrEventPublisherAdapter {
  publish(event: IrrScenarioEvent): Promise<void>;
}

export class IrrEventsPublisher {
  constructor(
    private readonly adapter: IrrEventPublisherAdapter,
    private readonly metrics: IrrEventMetrics
  ) {}

  async publish(event: IrrScenarioEvent): Promise<void> {
    try {
      await this.adapter.publish(event);
      this.metrics.published += 1;
    } catch {
      this.metrics.failed += 1;
      throw new Error('Failed to publish IRR scenario event');
    }
  }
}
