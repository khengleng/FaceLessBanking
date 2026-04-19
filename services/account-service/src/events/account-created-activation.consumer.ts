import type { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { AccountActivationApplication } from '../application/account-activation.application.js';

export class AccountCreatedActivationConsumer {
  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly accountActivationApplication: AccountActivationApplication
  ) {}

  async subscribe(): Promise<void> {
    await this.kafkaConsumer.subscribeAccountCreated(async (event: unknown) => {
      await this.accountActivationApplication.processAccountCreated(event);
    });
  }

  async start(): Promise<void> {
    await this.kafkaConsumer.start();
  }
}
