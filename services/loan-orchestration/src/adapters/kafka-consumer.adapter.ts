import { createEventBackboneConsumer, type EventBackboneConsumer } from '@faceless-banking/shared-events';

type LoanAccountCreatedHandler = (event: unknown) => Promise<void>;

export class KafkaConsumerAdapter {
  private readonly consumer: EventBackboneConsumer;
  private loanAccountCreatedHandler: LoanAccountCreatedHandler | null = null;

  constructor() {
    this.consumer = createEventBackboneConsumer({
      consumer: 'loan-orchestration-consumer',
      groupId: 'loan-orchestration-group',
      retry: { maxAttempts: 3 },
      dlq: { topic: 'loan-orchestration.consumer.dlq', enabled: true }
    });
  }

  async subscribePlaceholder(topics: string[]): Promise<void> {
    await this.consumer.subscribe(topics);
  }

  async subscribeLoanAccountCreated(handler: LoanAccountCreatedHandler): Promise<void> {
    this.loanAccountCreatedHandler = handler;
    await this.consumer.subscribe(['loan.account.created.v1']);
  }

  async handleLoanAccountCreated(event: unknown): Promise<void> {
    if (!this.loanAccountCreatedHandler) {
      return;
    }

    await this.loanAccountCreatedHandler(event);
  }

  async startPlaceholder(): Promise<void> {
    await this.consumer.start();
  }

  async start(): Promise<void> {
    await this.startPlaceholder();
  }
}
