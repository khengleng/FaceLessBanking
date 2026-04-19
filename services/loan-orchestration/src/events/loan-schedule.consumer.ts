import type { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { LoanScheduleApplication } from '../application/loan-schedule.application.js';

export class LoanScheduleConsumer {
  constructor(
    private readonly kafkaConsumer: KafkaConsumerAdapter,
    private readonly application: LoanScheduleApplication
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
