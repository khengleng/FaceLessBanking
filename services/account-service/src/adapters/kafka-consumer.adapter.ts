import { createEventBackboneConsumer, type EventBackboneConsumer } from '@faceless-banking/shared-events';

type CustomerCreatedHandler = (event: unknown) => Promise<void>;
type AccountCreatedHandler = (event: unknown) => Promise<void>;

export class KafkaConsumerAdapter {
  private readonly consumer: EventBackboneConsumer;
  private customerCreatedHandler: CustomerCreatedHandler | null = null;
  private accountCreatedHandler: AccountCreatedHandler | null = null;

  constructor() {
    const brokers = process.env.KAFKA_BOOTSTRAP_SERVERS?.split(',') ?? [];
    this.consumer = createEventBackboneConsumer({
      consumer: 'account-service-consumer',
      groupId: 'account-service-group',
      brokers,
      retry: { maxAttempts: 3 },
      dlq: { topic: 'account-service.consumer.dlq', enabled: true }
    });
  }

  async subscribeCustomerCreated(handler: CustomerCreatedHandler): Promise<void> {
    this.customerCreatedHandler = handler;
    await this.consumer.subscribe(['customer.created.v1']);
  }

  async subscribeAccountCreated(handler: AccountCreatedHandler): Promise<void> {
    this.accountCreatedHandler = handler;
    await this.consumer.subscribe(['account.created.v1']);
  }

  async start(): Promise<void> {
    await this.consumer.start(async (event) => {
      switch (event.type) {
        case 'customer.created.v1':
          if (this.customerCreatedHandler) {
            await this.customerCreatedHandler(event);
          }
          break;
        case 'account.created.v1':
          if (this.accountCreatedHandler) {
            await this.accountCreatedHandler(event);
          }
          break;
        default:
          console.warn(`Unhandled event type: ${event.type}`);
      }
    });
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }
}
