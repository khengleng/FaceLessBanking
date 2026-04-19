import type { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { PaymentProcessorApplication } from '../application/payment-processor.application.js';

export class PaymentProcessorConsumer {
  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly processor: PaymentProcessorApplication
  ) {}

  async subscribe(): Promise<void> {
    await this.kafkaConsumer.subscribePaymentInitiated(async (event: unknown) => {
      await this.processor.processPaymentInitiated(event);
    });
  }

  async start(): Promise<void> {
    await this.kafkaConsumer.start();
  }
}
