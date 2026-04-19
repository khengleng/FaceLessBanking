import type { Kafka, Consumer } from 'kafkajs';
import type { LiquidityApplication } from '../application/liquidity.application.js';

export class LiquidityConsumer {
  private consumer: Consumer;

  constructor(
    private readonly kafka: Kafka,
    private readonly application: LiquidityApplication,
    private readonly logger: {
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {
    this.consumer = this.kafka.consumer({ groupId: 'liquidity-service-group' });
  }

  async start() {
    await this.consumer.connect();
    
    await this.consumer.subscribe({ 
      topics: [
        'payment.status.updated.v1',
        'loan.disbursement.initiated.v1',
        'loan.repayment.initiated.v1',
        'fee.collected.v1'
      ], 
      fromBeginning: false 
    });

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;

        try {
          const event = JSON.parse(message.value.toString());
          
          // Filter for COMPLETED only for payment status updates
          if (topic === 'payment.status.updated.v1' && event.payload.status !== 'COMPLETED') {
            return;
          }

          await this.application.processFinancialEvent(event);
        } catch (err) {
          this.logger.error({ err, topic }, 'Failed to process liquidity event');
        }
      }
    });
  }
}
