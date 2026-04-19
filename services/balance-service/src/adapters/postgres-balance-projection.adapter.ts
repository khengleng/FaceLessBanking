import type { BalanceSnapshot } from '../domain/balance.js';

export type PostgresQueryResultRow = Record<string, unknown>;

export interface PostgresClient {
  query(
    text: string,
    params?: unknown[]
  ): Promise<{ rowCount: number | null; rows: PostgresQueryResultRow[] }>;
}

export class PostgresBalanceProjectionAdapter {
  constructor(private readonly db: PostgresClient) {}

  async getBalanceSnapshot(accountId: string): Promise<BalanceSnapshot | null> {
    const result = await this.db.query(
      `
        SELECT account_id, available_balance, ledger_balance, currency, version, updated_at
        FROM balance_projections
        WHERE account_id = $1
      `,
      [accountId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      accountId: String(row.account_id),
      availableBalance: Number(row.available_balance),
      ledgerBalance: Number(row.ledger_balance),
      currency: String(row.currency),
      version: Number(row.version),
      updatedAt: String(row.updated_at)
    };
  }

  async upsertBalanceProjection(snapshot: BalanceSnapshot): Promise<void> {
    await this.db.query(
      `
        INSERT INTO balance_projections (
          account_id, available_balance, ledger_balance, currency, version, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (account_id) DO UPDATE SET
          available_balance = EXCLUDED.available_balance,
          ledger_balance = EXCLUDED.ledger_balance,
          currency = EXCLUDED.currency,
          version = EXCLUDED.version,
          updated_at = EXCLUDED.updated_at
      `,
      [
        snapshot.accountId,
        snapshot.availableBalance,
        snapshot.ledgerBalance,
        snapshot.currency,
        snapshot.version,
        snapshot.updatedAt
      ]
    );
  }

  async createBalanceSnapshot(snapshot: BalanceSnapshot): Promise<void> {
    await this.upsertBalanceProjection(snapshot);
  }

  async hasProcessedProjectionEvent(eventId: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT event_id FROM balance_projection_events WHERE event_id = $1',
      [eventId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async markProjectionEventProcessed(eventId: string): Promise<void> {
    await this.db.query(
      `
        INSERT INTO balance_projection_events (event_id, processed_at)
        VALUES ($1, $2)
        ON CONFLICT (event_id) DO NOTHING
      `,
      [eventId, new Date().toISOString()]
    );
  }

  async hasProcessedSnapshotInitEvent(eventId: string): Promise<boolean> {
    return this.hasProcessedProjectionEvent(this.snapshotInitEventKey(eventId));
  }

  async markSnapshotInitEventProcessed(eventId: string): Promise<void> {
    await this.markProjectionEventProcessed(this.snapshotInitEventKey(eventId));
  }

  async hasProcessedEvent(eventId: string): Promise<boolean> {
    return this.hasProcessedProjectionEvent(eventId);
  }

  async markEventProcessed(eventId: string): Promise<void> {
    await this.markProjectionEventProcessed(eventId);
  }

  private snapshotInitEventKey(eventId: string): string {
    return `snapshot_init:${eventId}`;
  }
}
