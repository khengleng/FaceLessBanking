import { randomUUID } from 'node:crypto';

import type { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import type { Account } from '../domain/account.js';

export class AccountEventsPublisher {
  constructor(private readonly kafkaProducer: KafkaProducerAdapter) {}

  async emitAccountCreated(account: Account): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'account.created.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: `account-${account.accountId}`,
        causationId: `account-created-${account.accountId}`,
        timestamp: new Date().toISOString()
      },
      payload: {
        accountId: account.accountId,
        customerId: account.customerId,
        currency: account.currency,
        status: account.status
      }
    });
  }

  async emitAccountCreatedFromCustomer(input: {
    account: Account;
    correlationId: string;
    sourceEventId: string;
  }): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'account.created.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: input.correlationId,
        causationId: input.sourceEventId,
        timestamp: new Date().toISOString()
      },
      payload: {
        accountId: input.account.accountId,
        customerId: input.account.customerId,
        sourceEventId: input.sourceEventId,
        accountType: input.account.accountType ?? 'SAVINGS',
        status: input.account.status
      }
    });
  }

  async emitAccountActivated(input: {
    account: Account;
    oldStatus: Account['status'];
    correlationId: string;
    sourceEventId?: string;
  }): Promise<void> {
    await this.kafkaProducer.publish({
      type: 'account.activated.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: input.correlationId,
        causationId: input.sourceEventId,
        timestamp: new Date().toISOString()
      },
      payload: {
        accountId: input.account.accountId,
        customerId: input.account.customerId,
        oldStatus: input.oldStatus,
        newStatus: input.account.status,
        sourceEventId: input.sourceEventId,
        timestamp: new Date().toISOString()
      }
    });
  }
}
