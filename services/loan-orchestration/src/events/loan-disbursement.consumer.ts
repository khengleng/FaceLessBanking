import type { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { LoanDisbursementApplication } from '../application/loan-disbursement.application.js';

export class LoanDisbursementConsumer {
  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly application: LoanDisbursementApplication
  ) {}

  async subscribe(): Promise<void> {
    await this.kafkaConsumer.subscribeLoanAccountCreated(async (event: unknown) => {
      await this.application.processLoanAccountCreated(event);
    });
  }

  async start(): Promise<void> {
    await this.kafkaConsumer.start();
  }
}
