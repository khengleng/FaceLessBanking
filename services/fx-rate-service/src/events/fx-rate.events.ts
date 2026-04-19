import type { EventEnvelope } from '@faceless-banking/shared-events';
import type { FXRateUpdatedPayload } from '../domain/fx.js';
import type { FxRateEventMetrics } from './metrics.js';

export type FxRateUpdatedEvent = EventEnvelope<'fx.rate.updated.v1', FXRateUpdatedPayload>;

export interface FxRateEventPublisherAdapter {
  publishRateUpdated(event: FxRateUpdatedEvent): Promise<{ published: boolean }>;
}

export class FxRateEventsPublisher {
  constructor(
    private readonly adapter: FxRateEventPublisherAdapter,
    private readonly metrics: FxRateEventMetrics
  ) {}

  async publishRateUpdated(event: FxRateUpdatedEvent): Promise<{ published: boolean }> {
    try {
      const result = await this.adapter.publishRateUpdated(event);
      if (result.published) {
        this.metrics.published += 1;
      }
      return result;
    } catch {
      this.metrics.failed += 1;
      throw new Error('Failed to publish FX rate updated event');
    }
  }
}
