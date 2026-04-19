import type { CapitalEventMetrics } from './metrics.js';

export interface CapitalEventSubscriptionAdapter {
  subscribeExposureUpdates(handler: (event: unknown) => Promise<void>): Promise<void>;
  start(): Promise<void>;
}

export class CapitalEventConsumer {
  constructor(
    private readonly adapter: CapitalEventSubscriptionAdapter,
    private readonly onEvent: (event: unknown) => Promise<void>,
    private readonly metrics: CapitalEventMetrics
  ) {}

  async subscribe(): Promise<void> {
    await this.adapter.subscribeExposureUpdates(async (event: unknown) => {
      try {
        await this.onEvent(event);
        this.metrics.consumed += 1;
      } catch {
        this.metrics.failed += 1;
        throw new Error('Failed to process capital exposure event');
      }
    });
  }

  async start(): Promise<void> {
    await this.adapter.start();
  }
}
