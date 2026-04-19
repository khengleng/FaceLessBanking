import { createEventBackboneConsumer, type EventBackboneConsumer } from '@faceless-banking/shared-events';

type CustomerCreatedHandler = (event: unknown) => Promise<void>;
type AccountCreatedHandler = (event: unknown) => Promise<void>;

export class KafkaConsumerAdapter {
  private readonly consumer: EventBackboneConsumer;
  private customerCreatedHandler: CustomerCreatedHandler | null = null;
  private accountCreatedHandler: AccountCreatedHandler | null = null;

  constructor() {
    this.consumer = createEventBackboneConsumer({
      consumer: 'account-service-consumer',
      groupId: 'account-service-group',
      retry: { maxAttempts: 3 },
      dlq: { topic: 'account-service.consumer.dlq', enabled: true }
    });
  }

  async subscribePlaceholder(topics: string[]): Promise<void> {
    await this.consumer.subscribe(topics);
  }

  async subscribeCustomerCreated(handler: CustomerCreatedHandler): Promise<void> {
    this.customerCreatedHandler = handler;
    await this.consumer.subscribe(['customer.created.v1']);
  }

  async subscribeAccountCreated(handler: AccountCreatedHandler): Promise<void> {
    this.accountCreatedHandler = handler;
    await this.consumer.subscribe(['account.created.v1']);
  }

  async handleCustomerCreated(event: unknown): Promise<void> {
    if (!this.customerCreatedHandler) {
      return;
    }

    await this.customerCreatedHandler(event);
  }

  async handleAccountCreated(event: unknown): Promise<void> {
    if (!this.accountCreatedHandler) {
      return;
    }

    await this.accountCreatedHandler(event);
  }

  async startPlaceholder(): Promise<void> {
    await this.consumer.start();
  }

  async start(): Promise<void> {
    await this.consumer.start();
  }
}
