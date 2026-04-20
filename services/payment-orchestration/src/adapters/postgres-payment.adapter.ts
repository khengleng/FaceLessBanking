import pg from 'pg';
const { Pool } = pg;

import type { Beneficiary } from '../domain/beneficiary.js';
import type { Payment, PaymentStatus } from '../domain/payment.js';

export type PaymentStatusUpdateMetadata = {
  eventId: string;
  correlationId: string;
  stage: string;
};

export class PostgresPaymentAdapter {
  private readonly pool: pg.Pool;

  constructor(pool?: pg.Pool) {
    this.pool = pool ?? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async createPayment(payment: Payment): Promise<void> {
    const query = `
      INSERT INTO payments (
        payment_id, idempotency_key, source_account_id, destination_account_id, 
        amount, currency, channel, status, correlation_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (payment_id) DO NOTHING;
    `;
    const values = [
      payment.paymentId,
      payment.idempotencyKey,
      payment.sourceAccountId,
      payment.destinationAccountId,
      payment.amount,
      payment.currency,
      payment.channel,
      payment.status,
      payment.correlationId,
      payment.createdAt,
      payment.updatedAt
    ];
    await this.pool.query(query, values);
  }

  async getPaymentById(paymentId: string): Promise<Payment | null> {
    const query = 'SELECT * FROM payments WHERE payment_id = $1';
    const { rows } = await this.pool.query(query, [paymentId]);
    return rows.length > 0 ? this.mapRowToPayment(rows[0]) : null;
  }

  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    metadata?: PaymentStatusUpdateMetadata
  ): Promise<void> {
    const query = `
      UPDATE payments 
      SET status = $1, updated_at = $2 
      WHERE payment_id = $3
    `;
    const now = new Date().toISOString();
    await this.pool.query(query, [status, now, paymentId]);

    if (metadata) {
      await this.markConsumerEventProcessed(metadata.eventId, metadata.stage);
    }
  }

  async findPaymentByIdempotencyKey(idempotencyKey: string): Promise<Payment | null> {
    const query = 'SELECT * FROM payments WHERE idempotency_key = $1';
    const { rows } = await this.pool.query(query, [idempotencyKey]);
    return rows.length > 0 ? this.mapRowToPayment(rows[0]) : null;
  }

  async listPayments(input: {
    status?: PaymentStatus;
    accountId?: string;
    correlationId?: string;
    limit: number;
    offset: number;
  }): Promise<Payment[]> {
    let query = 'SELECT * FROM payments WHERE 1=1';
    const values: any[] = [];
    let paramCount = 1;

    if (input.status) {
      query += ` AND status = $${paramCount++}`;
      values.push(input.status);
    }
    if (input.accountId) {
      query += ` AND (source_account_id = $${paramCount} OR destination_account_id = $${paramCount})`;
      paramCount++;
      values.push(input.accountId);
    }
    if (input.correlationId) {
      query += ` AND correlation_id = $${paramCount++}`;
      values.push(input.correlationId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(input.limit, input.offset);

    const { rows } = await this.pool.query(query, values);
    return rows.map(row => this.mapRowToPayment(row));
  }

  async hasProcessedConsumerEvent(eventId: string, stage: string): Promise<boolean> {
    const query = 'SELECT 1 FROM processed_events WHERE event_id = $1 AND stage = $2';
    const { rows } = await this.pool.query(query, [eventId, stage]);
    return rows.length > 0;
  }

  async markConsumerEventProcessed(eventId: string, stage: string): Promise<void> {
    const query = 'INSERT INTO processed_events (event_id, stage) VALUES ($1, $2) ON CONFLICT DO NOTHING';
    await this.pool.query(query, [eventId, stage]);
  }

  async insertBeneficiary(beneficiary: Beneficiary): Promise<void> {
    const query = `
      INSERT INTO beneficiaries (
        beneficiary_id, customer_id, name, account_id, bank_code, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (beneficiary_id) DO NOTHING;
    `;
    const values = [
      beneficiary.beneficiaryId,
      beneficiary.customerId,
      beneficiary.name,
      beneficiary.accountId,
      beneficiary.bankCode,
      beneficiary.status,
      beneficiary.createdAt
    ];
    await this.pool.query(query, values);
  }

  private mapRowToPayment(row: any): Payment {
    return {
      paymentId: row.payment_id,
      idempotencyKey: row.idempotency_key,
      sourceAccountId: row.source_account_id,
      destinationAccountId: row.destination_account_id,
      amount: parseInt(row.amount, 10),
      currency: row.currency,
      channel: row.channel,
      status: row.status as PaymentStatus,
      correlationId: row.correlation_id,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
  }
}
