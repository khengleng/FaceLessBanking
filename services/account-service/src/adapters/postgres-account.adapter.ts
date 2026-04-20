import pg from 'pg';
const { Pool } = pg;

import type { Account, AccountStatus } from '../domain/account.js';
import type { DepositInterestAccrual } from '../domain/interest-accrual.js';

export class PostgresAccountAdapter {
  private readonly pool: pg.Pool;

  constructor(pool?: pg.Pool) {
    this.pool = pool ?? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async insertAccount(account: Account): Promise<void> {
    const query = `
      INSERT INTO accounts (
        account_id, customer_id, onboarding_reference, source_event_id, 
        account_type, product_code, currency, status, external_account_id, 
        available_balance_cents, ledger_balance_cents, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (account_id) DO NOTHING;
    `;
    const values = [
      account.accountId,
      account.customerId,
      account.onboardingReference ?? null,
      account.sourceEventId ?? null,
      account.accountType ?? null,
      account.productCode,
      account.currency,
      account.status,
      account.externalAccountId,
      account.availableBalanceCents,
      account.ledgerBalanceCents,
      account.createdAt,
      account.updatedAt ?? account.createdAt
    ];

    await this.pool.query(query, values);
  }

  async findAccountById(accountId: string): Promise<Account | null> {
    const query = 'SELECT * FROM accounts WHERE account_id = $1';
    const { rows } = await this.pool.query(query, [accountId]);
    
    if (rows.length === 0) {
      return null;
    }

    return this.mapRowToAccount(rows[0]);
  }

  async getAccountById(accountId: string): Promise<Account | null> {
    return this.findAccountById(accountId);
  }

  async createAccount(account: Account): Promise<void> {
    await this.insertAccount(account);
  }

  async findAccountByCustomerId(customerId: string): Promise<Account | null> {
    const query = 'SELECT * FROM accounts WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1';
    const { rows } = await this.pool.query(query, [customerId]);
    
    if (rows.length === 0) {
      return null;
    }

    return this.mapRowToAccount(rows[0]);
  }

  async listAccounts(input: {
    customerId?: string;
    accountId?: string;
    onboardingReference?: string;
    limit: number;
    offset: number;
  }): Promise<Account[]> {
    let query = 'SELECT * FROM accounts WHERE 1=1';
    const values: any[] = [];
    let paramCount = 1;

    if (input.customerId) {
      query += ` AND customer_id = $${paramCount++}`;
      values.push(input.customerId);
    }
    if (input.accountId) {
      query += ` AND account_id = $${paramCount++}`;
      values.push(input.accountId);
    }
    if (input.onboardingReference) {
      query += ` AND onboarding_reference = $${paramCount++}`;
      values.push(input.onboardingReference);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(input.limit, input.offset);

    const { rows } = await this.pool.query(query, values);
    return rows.map(row => this.mapRowToAccount(row));
  }

  async hasProcessedAccountCreationEvent(sourceEventId: string): Promise<boolean> {
    const query = 'SELECT 1 FROM processed_events WHERE event_id = $1 AND event_type = $2';
    const { rows } = await this.pool.query(query, [sourceEventId, 'ACCOUNT_CREATION']);
    return rows.length > 0;
  }

  async markAccountCreationEventProcessed(sourceEventId: string): Promise<void> {
    const query = 'INSERT INTO processed_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING';
    await this.pool.query(query, [sourceEventId, 'ACCOUNT_CREATION']);
  }

  async updateAccountStatus(accountId: string, status: Account['status']): Promise<void> {
    const query = 'UPDATE accounts SET status = $1, updated_at = $2 WHERE account_id = $3';
    await this.pool.query(query, [status, new Date().toISOString(), accountId]);
  }

  async hasProcessedActivationEvent(sourceEventId: string): Promise<boolean> {
    const query = 'SELECT 1 FROM processed_events WHERE event_id = $1 AND event_type = $2';
    const { rows } = await this.pool.query(query, [sourceEventId, 'ACCOUNT_ACTIVATION']);
    return rows.length > 0;
  }

  async markActivationEventProcessed(sourceEventId: string): Promise<void> {
    const query = 'INSERT INTO processed_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING';
    await this.pool.query(query, [sourceEventId, 'ACCOUNT_ACTIVATION']);
  }

  async findAccountsEligibleForInterestAccrual(productCode: string): Promise<Account[]> {
    const query = 'SELECT * FROM accounts WHERE status = $1 AND product_code = $2';
    const { rows } = await this.pool.query(query, ['ACTIVE', productCode]);
    return rows.map(row => this.mapRowToAccount(row));
  }

  async getBalanceSnapshot(accountId: string): Promise<number> {
    const query = 'SELECT available_balance_cents FROM accounts WHERE account_id = $1';
    const { rows } = await this.pool.query(query, [accountId]);
    return rows.length > 0 ? parseInt(rows[0].available_balance_cents, 10) : 0;
  }

  async hasDepositAccrualForAccountAndDate(accountId: string, accrualDate: string): Promise<boolean> {
    const query = 'SELECT 1 FROM deposit_interest_accruals WHERE account_id = $1 AND accrual_date = $2';
    const { rows } = await this.pool.query(query, [accountId, accrualDate]);
    return rows.length > 0;
  }

  async createDepositInterestAccrual(accrual: DepositInterestAccrual): Promise<void> {
    const query = `
      INSERT INTO deposit_interest_accruals (
        accrual_id, account_id, accrual_date, principal_basis_cents, 
        annual_interest_rate, accrued_interest_cents, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (accrual_id) DO NOTHING;
    `;
    const values = [
      accrual.accrualId,
      accrual.accountId,
      accrual.accrualDate,
      accrual.principalBasisCents,
      accrual.annualInterestRate,
      accrual.accruedInterestCents,
      accrual.status,
      accrual.createdAt
    ];
    await this.pool.query(query, values);
  }

  private mapRowToAccount(row: any): Account {
    return {
      accountId: row.account_id,
      customerId: row.customer_id,
      onboardingReference: row.onboarding_reference ?? undefined,
      sourceEventId: row.source_event_id ?? undefined,
      accountType: row.account_type ?? undefined,
      productCode: row.product_code,
      currency: row.currency,
      status: row.status as AccountStatus,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      externalAccountId: row.external_account_id,
      availableBalanceCents: parseInt(row.available_balance_cents, 10),
      ledgerBalanceCents: parseInt(row.ledger_balance_cents, 10),
    };
  }
}
