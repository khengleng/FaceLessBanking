import type { AlmEventMetrics } from './metrics.js';

export interface AlmEventSubscriptionAdapter {
  subscribePositionUpdates(handler: (event: unknown) => Promise<void>): Promise<void>;
  start(): Promise<void>;
}

export class AlmEventConsumer {
  constructor(
    private readonly adapter: AlmEventSubscriptionAdapter,
    private readonly onEvent: (event: unknown) => Promise<void>,
    private readonly metrics: AlmEventMetrics
  ) {}

  async subscribe(): Promise<void> {
    await this.adapter.subscribePositionUpdates(async (event: unknown) => {
      try {
        await this.onEvent(event);
        this.metrics.consumed += 1;
      } catch {
        this.metrics.failed += 1;
        throw new Error('Failed to process ALM position update event');
      }
    });
  }

  async start(): Promise<void> {
    await this.adapter.start();
  }
}
