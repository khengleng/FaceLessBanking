import type { Producer } from 'kafkajs';
import { randomUUID } from 'node:crypto';
import type { TreasuryTransfer } from '../domain/treasury.js';

export class TreasuryEventsPublisher {
  constructor(
    private readonly producer: Producer,
    private readonly source: string = 'treasury-operations'
  ) {}

  async emitTransferInitiated(transfer: TreasuryTransfer): Promise<void> {
    const event = {
      specVersion: '1.0',
      type: 'treasury.transfer.initiated.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: transfer.transferId,
        timestamp: new Date().toISOString(),
        producer: this.source
      },
      payload: {
        transferId: transfer.transferId,
        fromAccount: transfer.fromAccount,
        toAccount: transfer.toAccount,
        amountCents: transfer.amountCents.toString(),
        currency: transfer.currency,
        timestamp: transfer.createdAt
      }
    };

    await this.producer.send({
      topic: 'treasury.transfers.v1',
      messages: [{ key: transfer.transferId, value: JSON.stringify(event) }]
    });
  }
}
