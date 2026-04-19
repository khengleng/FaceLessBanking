import {
  createEventBackboneConsumer,
  type EventBackboneConsumer,
  type EventEnvelope
} from '@faceless-banking/shared-events';

type EkycStatusUpdatedHandler = (event: unknown) => Promise<void>;

export class KafkaConsumerAdapter {
  private readonly consumer: EventBackboneConsumer;
  private ekycStatusUpdatedHandler: EkycStatusUpdatedHandler | null = null;

  constructor() {
    this.consumer = createEventBackboneConsumer({
      consumer: 'workflow-case-management-consumer',
      groupId: 'workflow-case-management-group',
      retry: { maxAttempts: 3 },
      dlq: { topic: 'workflow-case-management.consumer.dlq', enabled: true }
    });
  }

  async subscribeEkycStatusUpdated(handler: EkycStatusUpdatedHandler): Promise<void> {
    this.ekycStatusUpdatedHandler = handler;
    await this.consumer.subscribe(['ekyc.status.updated.v1']);
  }

  async handleEkycStatusUpdated(
    event: EventEnvelope<string, Record<string, unknown>> | unknown
  ): Promise<void> {
    if (!this.ekycStatusUpdatedHandler) {
      return;
    }

    await this.ekycStatusUpdatedHandler(event);
  }

  async start(): Promise<void> {
    await this.consumer.start();
  }
}
