import type { KafkaAmlAdapter } from '../adapters/kafka-aml.adapter.js';
import type { AMLMonitoringApplication } from '../application/aml-monitoring.application.js';

export class AMLEventsConsumer {
  constructor(
    private readonly kafkaAdapter: KafkaAmlAdapter,
    private readonly application: AMLMonitoringApplication
  ) {}

  async subscribe(): Promise<void> {
    await this.kafkaAdapter.subscribePaymentEvents(async (event: unknown) => {
      await this.application.processPaymentEvent(event);
    });
  }
}
