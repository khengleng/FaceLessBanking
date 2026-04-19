import type { Pool } from 'pg';
import type { JournalEntry, JournalLine } from '../domain/journal.js';

export class PostgresAccountingAdapter {
  constructor(private readonly pool: Pool) {}

  async createJournalEntry(entry: JournalEntry): Promise<void> {
    const query = `
      INSERT INTO journal_entries (
        journal_id, source_event_id, source_event_type, description, total_debit, total_credit, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await this.pool.query(query, [
      entry.journalId,
      entry.sourceEventId,
      entry.sourceEventType,
      entry.description,
      entry.totalDebit,
      entry.totalCredit,
      entry.createdAt
    ]);
  }

  async createJournalLines(lines: JournalLine[]): Promise<void> {
    const query = `
      INSERT INTO journal_lines (
        line_id, journal_id, account_code, entry_type, amount, currency
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    // Simple batching for lines
    for (const line of lines) {
      await this.pool.query(query, [
        line.lineId,
        line.journalId,
        line.accountCode,
        line.entryType,
        line.amount,
        line.currency
      ]);
    }
  }

  async getJournalById(journalId: string): Promise<JournalEntry | null> {
    const query = 'SELECT * FROM journal_entries WHERE journal_id = $1';
    const result = await this.pool.query(query, [journalId]);
    return result.rows[0] || null;
  }

  async getJournalLines(journalId: string): Promise<JournalLine[]> {
    const query = 'SELECT * FROM journal_lines WHERE journal_id = $1';
    const result = await this.pool.query(query, [journalId]);
    return result.rows;
  }

  async hasProcessedAccountingEvent(eventId: string): Promise<boolean> {
    const query = 'SELECT 1 FROM processed_accounting_events WHERE event_id = $1';
    const result = await this.pool.query(query, [eventId]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async markAccountingEventProcessed(eventId: string): Promise<void> {
    const query = 'INSERT INTO processed_accounting_events (event_id, processed_at) VALUES ($1, $2)';
    await this.pool.query(query, [eventId, new Date().toISOString()]);
  }
}
