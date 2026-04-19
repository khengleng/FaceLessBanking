import type { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { SearchEventIndexerApplication } from '../application/search-event-indexer.application.js';

export class SearchIndexConsumer {
  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly indexer: SearchEventIndexerApplication
  ) {}

  async subscribe(): Promise<void> {
    await this.kafkaConsumer.subscribeLifecycleEvents(async (event: unknown) => {
      await this.indexer.processLifecycleEvent(event);
    });
  }

  async start(): Promise<void> {
    await this.kafkaConsumer.start();
  }
}
