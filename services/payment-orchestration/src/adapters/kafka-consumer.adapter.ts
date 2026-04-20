import {
  createEventBackboneConsumer,
  type EventBackboneConsumer,
} from '@faceless-banking/shared-events';

type PaymentInitiatedHandler = (event: unknown) => Promise<void>;

export class KafkaConsumerAdapter {
  private readonly consumer: EventBackboneConsumer;
  private paymentInitiatedHandler: PaymentInitiatedHandler | null = null;

  constructor() {
    const brokers = process.env.KAFKA_BOOTSTRAP_SERVERS?.split(',') ?? [];
    this.consumer = createEventBackboneConsumer({
      consumer: 'payment-orchestration-consumer',
      groupId: 'payment-orchestration-group',
      brokers,
      retry: { maxAttempts: 3 },
      dlq: { topic: 'payment-orchestration.consumer.dlq', enabled: true }
    });
  }

  async subscribePaymentInitiated(handler: PaymentInitiatedHandler): Promise<void> {
    this.paymentInitiatedHandler = handler;
    await this.consumer.subscribe(['payment.initiated.v1']);
  }

  async start(): Promise<void> {
    await this.consumer.start(async (event) => {
      if (event.type === 'payment.initiated.v1') {
        if (this.paymentInitiatedHandler) {
          await this.paymentInitiatedHandler(event);
        }
      } else {
        console.warn(`Payment orchestration received unhandled event type: ${event.type}`);
      }
    });
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }
}
