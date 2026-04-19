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
  private readonly loans = new Map<string, Loan>();
  private readonly repayments = new Map<string, Repayment>();
  private readonly schedulesByLoanAccountId = new Map<string, LoanRepaymentSchedule>();
  private readonly scheduleEntriesByScheduleId = new Map<string, LoanRepaymentScheduleEntry[]>();
  private readonly disbursementRequests = new Map<string, DisbursementRequestRecord>();
  private readonly processedDisbursementEvents = new Set<string>();
  private readonly processedScheduleGenerationEvents = new Set<string>();
  private readonly interestAccrualsByKey = new Map<string, LoanInterestAccrual>();
  private readonly interestAccrualsByLoan = new Map<string, LoanInterestAccrual[]>();

  async insertLoan(loan: Loan): Promise<void> {
    this.loans.set(loan.loanId, loan);
  }

  async findLoanById(loanId: string): Promise<Loan | null> {
    return this.loans.get(loanId) ?? null;
  }

  async getLoanAccountById(loanAccountId: string): Promise<Loan | null> {
    return this.findLoanById(loanAccountId);
  }

  async insertRepayment(repayment: Repayment): Promise<void> {
    this.repayments.set(repayment.repaymentId, repayment);
  }

  async createRepayment(repayment: Repayment): Promise<void> {
    await this.insertRepayment(repayment);
  }

  async findRepaymentById(repaymentId: string): Promise<Repayment | null> {
    return this.repayments.get(repaymentId) ?? null;
  }

  async updateLoanAccountStatus(loanAccountId: string, status: Loan['status']): Promise<void> {
    const loan = this.loans.get(loanAccountId);
    if (!loan) {
      return;
    }

    this.loans.set(loanAccountId, {
      ...loan,
      status
    });
  }

  async updateLoanStatus(loanAccountId: string, status: Loan['status']): Promise<void> {
    await this.updateLoanAccountStatus(loanAccountId, status);
  }

  async findOverdueLoans(): Promise<Loan[]> {
    const overdue: Loan[] = [];

    for (const loan of this.loans.values()) {
      const hasRepayment = [...this.repayments.values()]
        .some((repayment) => repayment.loanAccountId === loan.loanId);

      const isEligibleForDelinquencyCheck =
        loan.status === 'ACTIVE' || loan.status === 'DELINQUENT';

      if (!isEligibleForDelinquencyCheck) {
        continue;
      }

      if (!hasRepayment) {
        overdue.push(loan);
      }
    }

    return overdue;
  }

  async getRepaymentScheduleByLoanAccountId(loanAccountId: string): Promise<LoanRepaymentSchedule | null> {
    return this.schedulesByLoanAccountId.get(loanAccountId) ?? null;
  }

  async createRepaymentSchedule(schedule: LoanRepaymentSchedule): Promise<void> {
    this.schedulesByLoanAccountId.set(schedule.loanAccountId, schedule);
  }

  async createRepaymentScheduleEntries(entries: LoanRepaymentScheduleEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const scheduleId = entries[0].scheduleId;
    this.scheduleEntriesByScheduleId.set(scheduleId, entries);
  }

  async hasProcessedScheduleGenerationEvent(eventId: string): Promise<boolean> {
    return this.processedScheduleGenerationEvents.has(eventId);
  }

  async markScheduleGenerationEventProcessed(eventId: string): Promise<void> {
    this.processedScheduleGenerationEvents.add(eventId);
  }

  getRepaymentScheduleEntriesForTests(scheduleId: string): LoanRepaymentScheduleEntry[] {
    return this.scheduleEntriesByScheduleId.get(scheduleId) ?? [];
  }

  async hasProcessedDisbursementEvent(eventId: string): Promise<boolean> {
    return this.processedDisbursementEvents.has(eventId);
  }

  async markDisbursementEventProcessed(eventId: string): Promise<void> {
    this.processedDisbursementEvents.add(eventId);
  }

  async createDisbursementRequest(record: DisbursementRequestRecord): Promise<void> {
    this.disbursementRequests.set(record.disbursementRequestId, record);
  }

  getDisbursementRequestsForTests(): DisbursementRequestRecord[] {
    return [...this.disbursementRequests.values()];
  }

  async findLoanAccountsEligibleForAccrual(): Promise<Loan[]> {
    return [...this.loans.values()];
  }

  async getOutstandingPrincipal(loanAccountId: string): Promise<number> {
    const loan = this.loans.get(loanAccountId);
    if (!loan) {
      return NaN;
    }

    const completedRepayments = [...this.repayments.values()]
      .filter((repayment) => repayment.loanAccountId === loanAccountId && repayment.status === 'COMPLETED')
      .reduce((sum, repayment) => sum + repayment.amountCents, 0);

    return Math.max(loan.principalCents - completedRepayments, 0);
  }

  async hasAccrualForLoanAndDate(
    loanAccountId: string,
    accrualDate: string,
    accrualMode: AccrualMode
  ): Promise<boolean> {
    return this.interestAccrualsByKey.has(this.buildAccrualKey(loanAccountId, accrualDate, accrualMode));
  }

  async createInterestAccrual(accrual: LoanInterestAccrual): Promise<void> {
    const key = this.buildAccrualKey(accrual.loanAccountId, accrual.accrualDate, accrual.accrualMode);
    this.interestAccrualsByKey.set(key, accrual);

    const existing = this.interestAccrualsByLoan.get(accrual.loanAccountId) ?? [];
    this.interestAccrualsByLoan.set(accrual.loanAccountId, [...existing, accrual]);
  }

  getInterestAccrualsForLoanForTests(loanAccountId: string): LoanInterestAccrual[] {
    return this.interestAccrualsByLoan.get(loanAccountId) ?? [];
  }

  private buildAccrualKey(loanAccountId: string, accrualDate: string, accrualMode: AccrualMode): string {
    return `${loanAccountId}:${accrualDate}:${accrualMode}`;
  }
}
