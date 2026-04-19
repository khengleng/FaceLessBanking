import type { DashboardEventMetrics } from './metrics.js';

export interface DashboardEventSubscriptionAdapter {
  subscribeOperationalLifecycle(handler: (event: unknown) => Promise<void>): Promise<void>;
  start(): Promise<void>;
}

export class DashboardEventConsumer {
  constructor(
    private readonly adapter: DashboardEventSubscriptionAdapter,
    private readonly onEvent: (event: unknown) => Promise<void>,
    private readonly metrics: DashboardEventMetrics
  ) {}

  async subscribe(): Promise<void> {
    await this.adapter.subscribeOperationalLifecycle(async (event: unknown) => {
      try {
        await this.onEvent(event);
        this.metrics.consumed += 1;
      } catch {
        this.metrics.failed += 1;
        throw new Error('Failed to process dashboard lifecycle event');
      }
    });
  }

  async start(): Promise<void> {
    await this.adapter.start();
  }
}
