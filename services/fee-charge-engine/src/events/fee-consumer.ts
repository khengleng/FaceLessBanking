import type { Kafka, Consumer } from 'kafkajs';
import type { FeeEngineApplication } from '../application/fee-engine.application.js';
import type { FeeCollectionApplication } from '../application/fee-collection.application.js';

export class FeeEventConsumer {
  private consumer: Consumer;

  constructor(
    private readonly kafka: Kafka,
    private readonly application: FeeEngineApplication,
    private readonly collectionApp: FeeCollectionApplication,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {
    this.consumer = this.kafka.consumer({ groupId: 'fee-engine-group' });
  }

  async start() {
    await this.consumer.connect();
    
    // Subscribe to topics
    await this.consumer.subscribe({ 
      topics: [
        'payment.initiated.v1',
        'loan.disbursement.initiated.v1',
        'fee.assessed.v1'
      ], 
      fromBeginning: false 
    });

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;

        try {
          const event = JSON.parse(message.value.toString());
          const { eventId, correlationId } = event.metadata;
          this.logger.info({ eventId, topic }, 'Processing event in fee engine');

          if (topic === 'fee.assessed.v1') {
            await this.collectionApp.collectFee(event.payload.assessmentId, correlationId);
          } else {
            await this.application.evaluateEvent(event);
          }
        } catch (err) {
          this.logger.error({ err, topic }, 'Failed to process fee event');
        }
      }
    });
  }
}
