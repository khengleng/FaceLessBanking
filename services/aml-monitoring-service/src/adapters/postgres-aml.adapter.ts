import { randomUUID } from 'node:crypto';
import pg from 'pg';
const { Pool } = pg;

import type { AMLAlert, AMLAlertCandidate } from '../domain/aml-alert.js';

export class PostgresAmlAdapter {
  private readonly pool: pg.Pool;

  constructor(pool?: pg.Pool) {
    this.pool = pool ?? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
  }

  async createAmlAlert(candidate: AMLAlertCandidate): Promise<AMLAlert> {
    const alert: AMLAlert = {
      alertId: randomUUID(),
      sourceEventId: candidate.sourceEventId,
      entityType: candidate.entityType,
      entityId: candidate.entityId,
      ruleName: candidate.ruleName,
      severity: candidate.severity,
      status: 'OPEN',
      reason: candidate.reason,
      createdAt: new Date().toISOString()
    };

    const query = `
      INSERT INTO aml_alerts (
        alert_id, source_event_id, entity_type, entity_id, rule_name, severity, status, reason, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
    `;
    const values = [
      alert.alertId,
      alert.sourceEventId,
      alert.entityType,
      alert.entityId,
      alert.ruleName,
      alert.severity,
      alert.status,
      alert.reason,
      alert.createdAt
    ];

    await this.pool.query(query, values);
    return alert;
  }

  async getAmlAlertById(alertId: string): Promise<AMLAlert | null> {
    const query = 'SELECT * FROM aml_alerts WHERE alert_id = $1';
    const { rows } = await this.pool.query(query, [alertId]);
    return rows.length > 0 ? this.mapRowToAlert(rows[0]) : null;
  }

  async listAmlAlerts(): Promise<AMLAlert[]> {
    const query = 'SELECT * FROM aml_alerts ORDER BY created_at DESC';
    const { rows } = await this.pool.query(query);
    return rows.map(this.mapRowToAlert);
  }

  async hasProcessedAmlEvent(eventId: string): Promise<boolean> {
    const query = 'SELECT 1 FROM processed_aml_events WHERE event_id = $1';
    const { rows } = await this.pool.query(query, [eventId]);
    return rows.length > 0;
  }

  async markAmlEventProcessed(eventId: string): Promise<void> {
    const query = 'INSERT INTO processed_aml_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING';
    await this.pool.query(query, [eventId]);
  }

  async recordTransactionAndGetRecentCount(input: {
    sourceAccountId: string;
    customerId: string;
    windowMs: number;
  }): Promise<number> {
    const now = Date.now();
    const windowStart = now - input.windowMs;

    // First record the transaction
    await this.pool.query(
      'INSERT INTO aml_transaction_history (source_account_id, customer_id, created_at) VALUES ($1, $2, $3)',
      [input.sourceAccountId, input.customerId, now]
    );

    // Then get count of transactions for this account OR customer in the window
    const query = `
      SELECT COUNT(*) as count 
      FROM aml_transaction_history 
      WHERE created_at >= $1 
        AND (source_account_id = $2 OR customer_id = $3)
    `;
    const { rows } = await this.pool.query(query, [windowStart, input.sourceAccountId, input.customerId]);
    return parseInt(rows[0].count, 10);
  }

  private mapRowToAlert(row: any): AMLAlert {
    return {
      alertId: row.alert_id,
      sourceEventId: row.source_event_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      ruleName: row.rule_name,
      severity: row.severity,
      status: row.status,
      reason: row.reason,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
  }
}
