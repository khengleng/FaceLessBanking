import { createEventBackboneConsumer, type EventBackboneConsumer } from '@faceless-banking/shared-events';

export class KafkaConsumerAdapter {
  private readonly consumer: EventBackboneConsumer;

  constructor() {
    this.consumer = createEventBackboneConsumer({
      consumer: 'ekyc-orchestration-consumer',
      groupId: 'ekyc-orchestration-group',
      retry: { maxAttempts: 3 },
      dlq: { topic: 'ekyc-orchestration.consumer.dlq', enabled: true }
    });
  }

  async subscribePlaceholder(topics: string[]): Promise<void> {
    await this.consumer.subscribe(topics);
  }

  async startPlaceholder(): Promise<void> {
    await this.consumer.start();
  }
}
