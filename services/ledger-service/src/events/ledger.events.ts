import type { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import type { LedgerAnchor } from '../domain/ledger-anchor.js';

export class LedgerEventsPublisher {
  constructor(private readonly kafkaProducer: KafkaProducerAdapter) {}

  async emitAnchorRequested(anchor: LedgerAnchor): Promise<void> {
    await this.kafkaProducer.publish('ledger.anchor.requested', {
      anchorId: anchor.anchorId,
      eventId: anchor.eventId,
      chain: anchor.chain,
      status: anchor.status
    });
  }
}
