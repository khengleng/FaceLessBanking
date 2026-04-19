import {
  createEventBackboneConsumer,
  type EventBackboneConsumer,
  type EventEnvelope
} from '@faceless-banking/shared-events';

type PaymentStatusUpdatedHandler = (event: unknown) => Promise<void>;
type AccountActivatedHandler = (event: unknown) => Promise<void>;

export class KafkaConsumerAdapter {
  private readonly consumer: EventBackboneConsumer;
  private paymentStatusUpdatedHandler: PaymentStatusUpdatedHandler | null = null;
  private accountActivatedHandler: AccountActivatedHandler | null = null;

  constructor() {
    this.consumer = createEventBackboneConsumer({
      consumer: 'balance-service-consumer',
      groupId: 'balance-service-group',
      retry: { maxAttempts: 3 },
      dlq: { topic: 'balance-service.consumer.dlq', enabled: true }
    });
  }

  async subscribePaymentStatusUpdated(handler: PaymentStatusUpdatedHandler): Promise<void> {
    this.paymentStatusUpdatedHandler = handler;
    await this.consumer.subscribe(['payment.status.updated.v1']);
  }

  async subscribeAccountActivated(handler: AccountActivatedHandler): Promise<void> {
    this.accountActivatedHandler = handler;
    await this.consumer.subscribe(['account.activated.v1']);
  }

  async handlePaymentStatusUpdated(
    event: EventEnvelope<string, Record<string, unknown>> | unknown
  ): Promise<void> {
    if (!this.paymentStatusUpdatedHandler) {
      return;
    }

    await this.paymentStatusUpdatedHandler(event);
  }

  async handleAccountActivated(
    event: EventEnvelope<string, Record<string, unknown>> | unknown
  ): Promise<void> {
    if (!this.accountActivatedHandler) {
      return;
    }

    await this.accountActivatedHandler(event);
  }

  async start(): Promise<void> {
    await this.consumer.start();
  }
}
