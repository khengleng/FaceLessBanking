import pg from 'pg';
const { Pool } = pg;

import type { Loan } from '../domain/loan.js';
import type { Repayment } from '../domain/repayment.js';
import type { LoanRepaymentSchedule, LoanRepaymentScheduleEntry } from '../domain/repayment-schedule.js';
import type { AccrualMode, LoanInterestAccrual } from '../domain/interest-accrual.js';

export type DisbursementRequestRecord = {
  disbursementRequestId: string;
  loanAccountId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountCents: number;
  currency: string;
  paymentId: string;
  correlationId: string;
  createdAt: string;
};

export class PostgresLoanAdapter {
  private readonly pool: pg.Pool;

  constructor(pool?: pg.Pool) {
    this.pool = pool ?? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async insertLoan(loan: Loan): Promise<void> {
    const query = `
      INSERT INTO loans (
        loan_id, customer_id, principal_cents, interest_rate_bps, 
        currency, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (loan_id) DO NOTHING;
    `;
    const values = [
      loan.loanId,
      loan.customerId,
      loan.principalCents,
      loan.interestRateBps,
      loan.currency,
      loan.status,
      loan.createdAt,
      loan.updatedAt ?? loan.createdAt
    ];
    await this.pool.query(query, values);
  }

  async findLoanById(loanId: string): Promise<Loan | null> {
    const query = 'SELECT * FROM loans WHERE loan_id = $1';
    const { rows } = await this.pool.query(query, [loanId]);
    return rows.length > 0 ? this.mapRowToLoan(rows[0]) : null;
  }

  async getLoanAccountById(loanAccountId: string): Promise<Loan | null> {
    return this.findLoanById(loanAccountId);
  }

  async insertRepayment(repayment: Repayment): Promise<void> {
    const query = `
      INSERT INTO repayments (
        repayment_id, loan_account_id, amount_cents, currency, status, 
        repayment_date, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (repayment_id) DO NOTHING;
    `;
    const values = [
      repayment.repaymentId,
      repayment.loanAccountId,
      repayment.amountCents,
      repayment.currency,
      repayment.status,
      repayment.repaymentDate,
      repayment.createdAt
    ];
    await this.pool.query(query, values);
  }

  async createRepayment(repayment: Repayment): Promise<void> {
    await this.insertRepayment(repayment);
  }

  async findRepaymentById(repaymentId: string): Promise<Repayment | null> {
    const query = 'SELECT * FROM repayments WHERE repayment_id = $1';
    const { rows } = await this.pool.query(query, [repaymentId]);
    return rows.length > 0 ? this.mapRowToRepayment(rows[0]) : null;
  }

  async updateLoanAccountStatus(loanAccountId: string, status: Loan['status']): Promise<void> {
    const query = 'UPDATE loans SET status = $1, updated_at = $2 WHERE loan_id = $3';
    await this.pool.query(query, [status, new Date().toISOString(), loanAccountId]);
  }

  async updateLoanStatus(loanAccountId: string, status: Loan['status']): Promise<void> {
    await this.updateLoanAccountStatus(loanAccountId, status);
  }

  async findOverdueLoans(): Promise<Loan[]> {
    // A loan is considered overdue if it is ACTIVE or DELINQUENT and has no successful repayments 
    // This is a simplified "overdue" check to match current in-memory logic.
    const query = `
      SELECT l.* FROM loans l
      LEFT JOIN repayments r ON l.loan_id = r.loan_account_id
      WHERE l.status IN ('ACTIVE', 'DELINQUENT')
      GROUP BY l.loan_id
      HAVING COUNT(r.repayment_id) = 0
    `;
    const { rows } = await this.pool.query(query);
    return rows.map(row => this.mapRowToLoan(row));
  }

  async getRepaymentScheduleByLoanAccountId(loanAccountId: string): Promise<LoanRepaymentSchedule | null> {
    const query = 'SELECT * FROM repayment_schedules WHERE loan_account_id = $1';
    const { rows } = await this.pool.query(query, [loanAccountId]);
    if (rows.length === 0) return null;
    
    const schedule = rows[0];
    const entriesQuery = 'SELECT * FROM repayment_schedule_entries WHERE schedule_id = $1 ORDER BY due_date ASC';
    const { rows: entries } = await this.pool.query(entriesQuery, [schedule.schedule_id]);

    return {
      scheduleId: schedule.schedule_id,
      loanAccountId: schedule.loan_account_id,
      status: schedule.status,
      createdAt: schedule.created_at.toISOString(),
      entries: entries.map(e => this.mapRowToScheduleEntry(e))
    };
  }

  async createRepaymentSchedule(schedule: LoanRepaymentSchedule): Promise<void> {
    const query = `
      INSERT INTO repayment_schedules (schedule_id, loan_account_id, status, created_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (loan_account_id) DO UPDATE SET status = EXCLUDED.status;
    `;
    await this.pool.query(query, [schedule.scheduleId, schedule.loanAccountId, schedule.status, schedule.createdAt]);
  }

  async createRepaymentScheduleEntries(entries: LoanRepaymentScheduleEntry[]): Promise<void> {
    if (entries.length === 0) return;

    const values: any[] = [];
    let query = 'INSERT INTO repayment_schedule_entries (entry_id, schedule_id, due_date, principal_due_cents, interest_due_cents, status, created_at) VALUES ';
    
    for (let i = 0; i < entries.length; i++) {
      const offset = i * 7;
      query += `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})${i === entries.length - 1 ? '' : ','} `;
      values.push(
        entries[i].entryId,
        entries[i].scheduleId,
        entries[i].dueDate,
        entries[i].principalDueCents,
        entries[i].interestDueCents,
        entries[i].status,
        entries[i].createdAt
      );
    }
    query += ' ON CONFLICT (entry_id) DO NOTHING';
    await this.pool.query(query, values);
  }

  async hasProcessedScheduleGenerationEvent(eventId: string): Promise<boolean> {
    const query = 'SELECT 1 FROM processed_events WHERE event_id = $1 AND event_type = $2';
    const { rows } = await this.pool.query(query, [eventId, 'SCHEDULE_GENERATION']);
    return rows.length > 0;
  }

  async markScheduleGenerationEventProcessed(eventId: string): Promise<void> {
    const query = 'INSERT INTO processed_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING';
    await this.pool.query(query, [eventId, 'SCHEDULE_GENERATION']);
  }

  async hasProcessedDisbursementEvent(eventId: string): Promise<boolean> {
    const query = 'SELECT 1 FROM processed_events WHERE event_id = $1 AND event_type = $2';
    const { rows } = await this.pool.query(query, [eventId, 'DISBURSEMENT']);
    return rows.length > 0;
  }

  async markDisbursementEventProcessed(eventId: string): Promise<void> {
    const query = 'INSERT INTO processed_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING';
    await this.pool.query(query, [eventId, 'DISBURSEMENT']);
  }

  async createDisbursementRequest(record: DisbursementRequestRecord): Promise<void> {
    const query = `
      INSERT INTO disbursement_requests (
        disbursement_request_id, loan_account_id, source_account_id, destination_account_id, 
        amount_cents, currency, payment_id, correlation_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (disbursement_request_id) DO NOTHING;
    `;
    const values = [
      record.disbursementRequestId,
      record.loanAccountId,
      record.sourceAccountId,
      record.destinationAccountId,
      record.amountCents,
      record.currency,
      record.paymentId,
      record.correlationId,
      record.createdAt
    ];
    await this.pool.query(query, values);
  }

  async findLoanAccountsEligibleForAccrual(): Promise<Loan[]> {
    const query = "SELECT * FROM loans WHERE status IN ('ACTIVE', 'DELINQUENT')";
    const { rows } = await this.pool.query(query);
    return rows.map(row => this.mapRowToLoan(row));
  }

  async getOutstandingPrincipal(loanAccountId: string): Promise<number> {
    const loan = await this.findLoanById(loanAccountId);
    if (!loan) return NaN;

    const query = "SELECT COALESCE(SUM(amount_cents), 0) as total FROM repayments WHERE loan_account_id = $1 AND status = 'COMPLETED'";
    const { rows } = await this.pool.query(query, [loanAccountId]);
    const paid = parseInt(rows[0].total, 10);

    return Math.max(loan.principalCents - paid, 0);
  }

  async hasAccrualForLoanAndDate(
    loanAccountId: string,
    accrualDate: string,
    accrualMode: AccrualMode
  ): Promise<boolean> {
    const query = 'SELECT 1 FROM loan_interest_accruals WHERE loan_account_id = $1 AND accrual_date = $2 AND accrual_mode = $3';
    const { rows } = await this.pool.query(query, [loanAccountId, accrualDate, accrualMode]);
    return rows.length > 0;
  }

  async createInterestAccrual(accrual: LoanInterestAccrual): Promise<void> {
    const query = `
      INSERT INTO loan_interest_accruals (
        accrual_id, loan_account_id, accrual_mode, accrual_date, 
        accrued_interest_cents, principal_basis_cents, annual_interest_rate, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (accrual_id) DO NOTHING;
    `;
    const values = [
      accrual.accrualId,
      accrual.loanAccountId,
      accrual.accrualMode,
      accrual.accrualDate,
      accrual.accruedInterest,
      accrual.principalBasis,
      accrual.annualInterestRate,
      accrual.createdAt
    ];
    await this.pool.query(query, values);
  }

  private mapRowToLoan(row: any): Loan {
    return {
      loanId: row.loan_id,
      customerId: row.customer_id,
      principalCents: parseInt(row.principal_cents, 10),
      interestRateBps: row.interest_rate_bps,
      currency: row.currency,
      status: row.status as any,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapRowToRepayment(row: any): Repayment {
    return {
      repaymentId: row.repayment_id,
      loanAccountId: row.loan_account_id,
      amountCents: parseInt(row.amount_cents, 10),
      currency: row.currency,
      status: row.status as any,
      repaymentDate: row.repayment_date.toISOString(),
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapRowToScheduleEntry(row: any): LoanRepaymentScheduleEntry {
    return {
      entryId: row.entry_id,
      scheduleId: row.schedule_id,
      dueDate: row.due_date.toISOString().split('T')[0],
      principalDueCents: parseInt(row.principal_due_cents, 10),
      interestDueCents: parseInt(row.interest_due_cents, 10),
      status: row.status as any,
      createdAt: row.created_at.toISOString(),
    };
  }
}
