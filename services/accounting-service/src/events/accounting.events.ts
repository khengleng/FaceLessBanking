import type { Producer } from 'kafkajs';
import { randomUUID } from 'node:crypto';
import type { JournalWithLines } from '../domain/journal.js';

export class AccountingEventsPublisher {
  private readonly topic = 'accounting.journal.posted.v1';

  constructor(
    private readonly producer: Producer,
    private readonly source: string = 'accounting-service'
  ) {}

  async emitJournalPosted(journal: JournalWithLines, correlationId?: string): Promise<void> {
    const event = {
      specVersion: '1.0',
      type: 'accounting.journal.posted.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: correlationId || randomUUID(),
        timestamp: new Date().toISOString(),
        producer: this.source
      },
      payload: {
        journalId: journal.entry.journalId,
        sourceEventId: journal.entry.sourceEventId,
        sourceEventType: journal.entry.sourceEventType,
        totalDebit: journal.entry.totalDebit,
        totalCredit: journal.entry.totalCredit,
        lines: journal.lines.map((l) => ({
          accountCode: l.accountCode,
          entryType: l.entryType,
          amount: l.amount,
          currency: l.currency
        }))
      }
    };

    await this.producer.send({
      topic: this.topic,
      messages: [{ 
        key: journal.entry.journalId,
        value: JSON.stringify(event) 
      }]
    });
  }
}
