import type { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { PaymentAuditEnricherApplication } from '../application/payment-audit-enricher.application.js';

export class PaymentLifecycleConsumer {
  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly enricher: PaymentAuditEnricherApplication
  ) {}

  async subscribe(): Promise<void> {
    await this.kafkaConsumer.subscribePaymentLifecycle(async (event: unknown) => {
      await this.enricher.processLifecycleEvent(event);
    });
  }

  async start(): Promise<void> {
    await this.kafkaConsumer.start();
  }
}
