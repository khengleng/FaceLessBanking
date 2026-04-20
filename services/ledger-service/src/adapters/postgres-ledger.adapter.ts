import pg from 'pg';
const { Pool } = pg;

import type { LedgerAnchor, LedgerAnchorStatus } from '../domain/ledger-anchor.js';

export class PostgresLedgerAdapter {
  private readonly pool: pg.Pool;

  constructor(pool?: pg.Pool) {
    this.pool = pool ?? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async insertAnchor(anchor: LedgerAnchor): Promise<void> {
    const query = `
      INSERT INTO ledger_anchors (
        anchor_id, event_id, hash, chain, status, transaction_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (anchor_id) DO NOTHING;
    `;
    const values = [
      anchor.anchorId,
      anchor.eventId,
      anchor.hash,
      anchor.chain,
      anchor.status,
      anchor.transactionId,
      anchor.createdAt
    ];
    await this.pool.query(query, values);
  }

  async findAnchorById(anchorId: string): Promise<LedgerAnchor | null> {
    const query = 'SELECT * FROM ledger_anchors WHERE anchor_id = $1';
    const { rows } = await this.pool.query(query, [anchorId]);
    return rows.length > 0 ? this.mapRowToAnchor(rows[0]) : null;
  }

  async findAnchorByEventId(eventId: string): Promise<LedgerAnchor | null> {
    const query = 'SELECT * FROM ledger_anchors WHERE event_id = $1';
    const { rows } = await this.pool.query(query, [eventId]);
    return rows.length > 0 ? this.mapRowToAnchor(rows[0]) : null;
  }

  private mapRowToAnchor(row: any): LedgerAnchor {
    return {
      anchorId: row.anchor_id,
      eventId: row.event_id,
      hash: row.hash,
      chain: row.chain,
      status: row.status as LedgerAnchorStatus,
      transactionId: row.transaction_id,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
  }
}
