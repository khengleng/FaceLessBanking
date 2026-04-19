import type { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { PaymentNotificationTriggerApplication } from '../application/payment-notification-trigger.application.js';

export class PaymentStatusConsumer {
  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly triggerApplication: PaymentNotificationTriggerApplication
  ) {}

  async subscribe(): Promise<void> {
    await this.kafkaConsumer.subscribePaymentStatusUpdated(async (event: unknown) => {
      await this.triggerApplication.processPaymentStatusUpdated(event);
    });
  }

  async start(): Promise<void> {
    await this.kafkaConsumer.start();
  }
}
