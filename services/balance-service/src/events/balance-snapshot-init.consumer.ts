import type { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { BalanceSnapshotInitApplication } from '../application/balance-snapshot-init.application.js';

export class BalanceSnapshotInitConsumer {
  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly application: BalanceSnapshotInitApplication
  ) {}

  async subscribe(): Promise<void> {
    await this.kafkaConsumer.subscribeAccountActivated(async (event: unknown) => {
      await this.application.processAccountActivated(event);
    });
  }

  async start(): Promise<void> {
    await this.kafkaConsumer.start();
  }
}
