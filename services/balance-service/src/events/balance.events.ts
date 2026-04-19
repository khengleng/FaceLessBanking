import type { BalanceProjectionEvent } from '../domain/balance-projection-event.js';

export class BalanceEventsPublisher {
  async emitProjectionApplied(event: BalanceProjectionEvent): Promise<void> {
    void event;
    // TODO: publish balance.projection.applied.v1 when event bus integration is enabled.
  }
}
