import type { LoanInterestAccrualApplication, RunInterestAccrualResult } from '../application/loan-interest-accrual.application.js';

export class LoanInterestAccrualScheduler {
  constructor(private readonly application: LoanInterestAccrualApplication) {}

  async runDaily(accrualDate: string, correlationId?: string): Promise<RunInterestAccrualResult> {
    return this.application.runAccrualForMode({
      accrualMode: 'DAILY',
      accrualDate,
      correlationId
    });
  }

  async runMonthly(accrualDate: string, correlationId?: string): Promise<RunInterestAccrualResult> {
    return this.application.runAccrualForMode({
      accrualMode: 'MONTHLY',
      accrualDate,
      correlationId
    });
  }
}
