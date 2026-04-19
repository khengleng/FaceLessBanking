import type { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { CustomerAccountCreationApplication } from '../application/customer-account-creation.application.js';

export class CustomerCreatedConsumer {
  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly customerAccountCreationApplication: CustomerAccountCreationApplication
  ) {}

  async subscribe(): Promise<void> {
    await this.kafkaConsumer.subscribeCustomerCreated(async (event: unknown) => {
      await this.customerAccountCreationApplication.processCustomerCreated(event);
    });
  }

  async start(): Promise<void> {
    await this.kafkaConsumer.start();
  }
}
