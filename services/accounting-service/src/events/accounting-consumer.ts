import type { Kafka, Consumer } from 'kafkajs';
import type {
  AccountingApplication,
  LoanDisbursementInitiatedEvent,
  LoanInterestAccruedEvent,
  PaymentStatusUpdatedEvent
} from '../application/accounting.application.js';

type AccountingLogger = {
  error: (payload: Record<string, unknown>, message: string) => void;
};

export class AccountingConsumer {
  private consumer: Consumer;

  constructor(
    private readonly kafka: Kafka,
    private readonly application: AccountingApplication,
    private readonly logger: AccountingLogger
  ) {
    this.consumer = this.kafka.consumer({ groupId: 'accounting-group' });
  }

  async start() {
    await this.consumer.connect();
    
    // Subscribe to topics
    await this.consumer.subscribe({ topics: [
      'payment.status.updated.v1',
      'loan.disbursement.initiated.v1',
      'loan.interest.accrued.v1'
    ], fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;

        const event = JSON.parse(message.value.toString()) as {
          metadata?: { eventId?: string };
          payload?: unknown;
        };
        if (!event.metadata?.eventId) {
          this.logger.error({ topic }, 'Skipping accounting event without metadata.eventId');
          return;
        }
        const eventId = event.metadata.eventId;

        try {
          switch (topic) {
            case 'payment.status.updated.v1':
              await this.application.processPaymentCompleted(event as PaymentStatusUpdatedEvent);
              break;
            case 'loan.disbursement.initiated.v1':
              await this.application.processLoanDisbursement(event as LoanDisbursementInitiatedEvent);
              break;
            case 'loan.interest.accrued.v1':
              await this.application.processLoanInterestAccrual(event as LoanInterestAccruedEvent);
              break;
          }
        } catch (err) {
          this.logger.error({ err, eventId, topic }, 'Failed to process accounting event');
          // In a real system, send to DLQ here
        }
      }
    });
  }
}
