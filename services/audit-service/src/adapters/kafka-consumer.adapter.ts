import {
  createEventBackboneConsumer,
  type EventBackboneConsumer,
} from '@faceless-banking/shared-events';

type PaymentLifecycleHandler = (event: unknown) => Promise<void>;

export class KafkaConsumerAdapter {
  private readonly consumer: EventBackboneConsumer;
  private paymentLifecycleHandler: PaymentLifecycleHandler | null = null;

  constructor() {
    const brokers = process.env.KAFKA_BOOTSTRAP_SERVERS?.split(',') ?? [];
    this.consumer = createEventBackboneConsumer({
      consumer: 'audit-service-consumer',
      groupId: 'audit-service-group',
      brokers,
      retry: { maxAttempts: 3 },
      dlq: { topic: 'audit-service.consumer.dlq', enabled: true }
    });
  }

  async subscribePaymentLifecycle(handler: PaymentLifecycleHandler): Promise<void> {
    this.paymentLifecycleHandler = handler;
    await this.consumer.subscribe(['payment.initiated.v1', 'payment.status.updated.v1']);
  }

  async start(): Promise<void> {
    await this.consumer.start(async (event) => {
      if (['payment.initiated.v1', 'payment.status.updated.v1'].includes(event.type)) {
        if (this.paymentLifecycleHandler) {
          await this.paymentLifecycleHandler(event);
        }
      } else {
        console.warn(`Audit service received unhandled event type: ${event.type}`);
      }
    });
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }
}
