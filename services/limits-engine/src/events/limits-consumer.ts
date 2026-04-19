import type { Kafka, Consumer } from 'kafkajs';
import type { LimitsApplication } from '../application/limits.application.js';

export class LimitsConsumer {
  private consumer: Consumer;

  constructor(
    private readonly kafka: Kafka,
    private readonly application: LimitsApplication,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {
    this.consumer = this.kafka.consumer({ groupId: 'limits-engine-group' });
  }

  async start() {
    await this.consumer.connect();
    
    await this.consumer.subscribe({ 
      topics: [
        'payment.initiated.v1',
        'loan.disbursement.initiated.v1'
      ], 
      fromBeginning: false 
    });

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;

        try {
          JSON.parse(message.value.toString());

          // For payment, we might use customerId as entityId
          // Hardcoded logic for rule matching in this skeleton
          // In real life, we'd lookup which rules apply to this transaction
          this.logger.info({ topic }, 'Ignoring usage update from consumer in this skeleton to avoid complex rule matching logic without full context');
          
        } catch (err) {
          this.logger.error({ err, topic }, 'Failed to process limit consumer event');
        }
      }
    });
  }
}
