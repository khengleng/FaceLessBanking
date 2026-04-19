import {
  createEventBackboneConsumer,
  type EventBackboneConsumer,
  type EventEnvelope
} from '@faceless-banking/shared-events';

type PaymentInitiatedHandler = (event: unknown) => Promise<void>;

export class KafkaConsumerAdapter {
  private readonly consumer: EventBackboneConsumer;
  private paymentInitiatedHandler: PaymentInitiatedHandler | null = null;

  constructor() {
    this.consumer = createEventBackboneConsumer({
      consumer: 'payment-orchestration-consumer',
      groupId: 'payment-orchestration-group',
      retry: { maxAttempts: 3 },
      dlq: { topic: 'payment-orchestration.consumer.dlq', enabled: true }
    });
  }

  async subscribePaymentInitiated(handler: PaymentInitiatedHandler): Promise<void> {
    this.paymentInitiatedHandler = handler;
    await this.consumer.subscribe(['payment.initiated.v1']);
  }

  async handlePaymentInitiated(
    event: EventEnvelope<string, Record<string, unknown>> | unknown
  ): Promise<void> {
    if (!this.paymentInitiatedHandler) {
      return;
    }

    await this.paymentInitiatedHandler(event);
  }

  async start(): Promise<void> {
    await this.consumer.start();
  }
}
