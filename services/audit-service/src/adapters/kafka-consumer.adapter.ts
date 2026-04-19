import {
  createEventBackboneConsumer,
  type EventBackboneConsumer,
  type EventEnvelope
} from '@faceless-banking/shared-events';

type PaymentLifecycleHandler = (event: unknown) => Promise<void>;

export class KafkaConsumerAdapter {
  private readonly consumer: EventBackboneConsumer;
  private paymentLifecycleHandler: PaymentLifecycleHandler | null = null;

  constructor() {
    this.consumer = createEventBackboneConsumer({
      consumer: 'audit-service-consumer',
      groupId: 'audit-service-group',
      retry: { maxAttempts: 3 },
      dlq: { topic: 'audit-service.consumer.dlq', enabled: true }
    });
  }

  async subscribePaymentLifecycle(handler: PaymentLifecycleHandler): Promise<void> {
    this.paymentLifecycleHandler = handler;
    await this.consumer.subscribe(['payment.initiated.v1', 'payment.status.updated.v1']);
  }

  async handlePaymentLifecycle(
    event: EventEnvelope<string, Record<string, unknown>> | unknown
  ): Promise<void> {
    if (!this.paymentLifecycleHandler) {
      return;
    }

    await this.paymentLifecycleHandler(event);
  }

  async start(): Promise<void> {
    await this.consumer.start();
  }
}
