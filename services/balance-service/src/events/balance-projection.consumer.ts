import type { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { BalanceProjectionUpdaterApplication } from '../application/balance-projection-updater.application.js';

export class BalanceProjectionConsumer {
  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly updater: BalanceProjectionUpdaterApplication
  ) {}

  async subscribe(): Promise<void> {
    await this.kafkaConsumer.subscribePaymentStatusUpdated(async (event: unknown) => {
      await this.updater.processPaymentStatusUpdated(event);
    });
  }

  async start(): Promise<void> {
    await this.kafkaConsumer.start();
  }
}
