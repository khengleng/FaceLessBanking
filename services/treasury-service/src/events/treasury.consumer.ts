import type { TreasuryEventMetrics } from './metrics.js';

export interface TreasuryEventSubscriptionAdapter {
  subscribeTransferStatus(handler: (event: unknown) => Promise<void>): Promise<void>;
  start(): Promise<void>;
}

export class TreasuryEventConsumer {
  constructor(
    private readonly adapter: TreasuryEventSubscriptionAdapter,
    private readonly onEvent: (event: unknown) => Promise<void>,
    private readonly metrics: TreasuryEventMetrics
  ) {}

  async subscribe(): Promise<void> {
    await this.adapter.subscribeTransferStatus(async (event: unknown) => {
      try {
        await this.onEvent(event);
        this.metrics.consumed += 1;
      } catch {
        this.metrics.failed += 1;
        throw new Error('Failed to process treasury transfer status event');
      }
    });
  }

  async start(): Promise<void> {
    await this.adapter.start();
  }
}
