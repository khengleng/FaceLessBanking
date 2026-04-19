import { randomUUID } from 'node:crypto';
import type { DepositInterestAccrual } from '../domain/interest-accrual.js';
import type { EventPublishInput } from '@faceless-banking/shared-events';

type ProducerLike = {
  send?: (payload: {
    topic: string;
    messages: Array<{ key: string; value: string }>;
  }) => Promise<void>;
  publish?: (payload: EventPublishInput) => Promise<unknown>;
};

export class InterestEventsPublisher {
  private readonly topic = 'deposit.interest.accrued.v1';

  constructor(
    private readonly producer: ProducerLike,
    private readonly source: string = 'account-service'
  ) {}

  async emitInterestAccrued(accrual: DepositInterestAccrual, correlationId?: string): Promise<void> {
    const payload = {
      accrualId: accrual.accrualId,
      accountId: accrual.accountId,
      accrualDate: accrual.accrualDate,
      principalBasisCents: accrual.principalBasisCents,
      annualInterestRate: accrual.annualInterestRate,
      accruedInterestCents: accrual.accruedInterestCents,
      currency: 'USD' // Placeholder, should ideally come from account
    };

    if (this.producer.publish) {
      await this.producer.publish({
        type: this.topic,
        payload,
        metadata: {
          correlationId: correlationId || randomUUID()
        }
      });
      return;
    }

    if (this.producer.send) {
      const event = {
        specVersion: '1.0',
        type: 'deposit.interest.accrued.v1',
        version: 1,
        metadata: {
          eventId: randomUUID(),
          correlationId: correlationId || randomUUID(),
          timestamp: new Date().toISOString(),
          producer: this.source
        },
        payload
      };

      await this.producer.send({
        topic: this.topic,
        messages: [{
          key: accrual.accountId,
          value: JSON.stringify(event)
        }]
      });
      return;
    }

    throw new Error('interest_events_producer_not_configured');
  }
}
