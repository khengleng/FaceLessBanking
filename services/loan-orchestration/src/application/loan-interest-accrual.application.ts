import {
  calculateSimpleInterestAccrual,
  type AccrualMode,
  type LoanInterestAccrual
} from '../domain/interest-accrual.js';
import type { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import type { LoanEventsPublisher } from '../events/loan.events.js';
import type { LoanInterestAccrualMetrics } from '../events/metrics.js';

export type RunInterestAccrualResult = {
  scanned: number;
  processed: number;
  duplicatesSkipped: number;
  inactiveSkipped: number;
  failures: number;
  monthlyBoundarySkipped: boolean;
};

export class LoanInterestAccrualApplication {
  constructor(
    private readonly postgresAdapter: PostgresLoanAdapter,
    private readonly loanEvents: LoanEventsPublisher,
    private readonly metrics: LoanInterestAccrualMetrics,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    },
    private readonly defaultAnnualInterestRateBps: number,
    private readonly dayCountBasis: number
  ) {}

  async runAccrualForMode(input: {
    accrualMode: AccrualMode;
    accrualDate: string;
    correlationId?: string;
  }): Promise<RunInterestAccrualResult> {
    const normalizedAccrualDate = normalizeAccrualDate(input.accrualDate);
    const correlationId = input.correlationId;

    if (input.accrualMode === 'MONTHLY' && !isMonthlyBoundary(normalizedAccrualDate)) {
      this.logger.info(
        { accrualMode: input.accrualMode, accrualDate: normalizedAccrualDate, correlationId },
        'Skipping monthly accrual run because date is not on monthly boundary placeholder'
      );

      return {
        scanned: 0,
        processed: 0,
        duplicatesSkipped: 0,
        inactiveSkipped: 0,
        failures: 0,
        monthlyBoundarySkipped: true
      };
    }

    const loans = await this.postgresAdapter.findLoanAccountsEligibleForAccrual();
    this.metrics.recordEligibleLoanAccountsScanned(loans.length);

    let processed = 0;
    let duplicatesSkipped = 0;
    let inactiveSkipped = 0;
    let failures = 0;

    for (const loan of loans) {
      if (loan.status !== 'ACTIVE' && loan.status !== 'DELINQUENT') {
        inactiveSkipped += 1;
        continue;
      }

      const duplicate = await this.postgresAdapter.hasAccrualForLoanAndDate(
        loan.loanId,
        normalizedAccrualDate,
        input.accrualMode
      );

      if (duplicate) {
        duplicatesSkipped += 1;
        this.metrics.recordAccrualSkippedDuplicate();
        continue;
      }

      const principalBasis = await this.postgresAdapter.getOutstandingPrincipal(loan.loanId);
      const annualInterestRateBps = loan.annualInterestRateBps ?? this.defaultAnnualInterestRateBps;

      if (!Number.isFinite(principalBasis) || principalBasis < 0 || !Number.isFinite(annualInterestRateBps) || annualInterestRateBps <= 0) {
        failures += 1;
        this.metrics.recordAccrualFailure();
        this.logger.error(
          {
            loanAccountId: loan.loanId,
            principalBasis,
            annualInterestRateBps,
            accrualMode: input.accrualMode,
            accrualDate: normalizedAccrualDate,
            correlationId
          },
          'Failed interest accrual due to malformed loan data'
        );
        continue;
      }

      const accrual = calculateSimpleInterestAccrual({
        loanAccountId: loan.loanId,
        accrualMode: input.accrualMode,
        accrualDate: normalizedAccrualDate,
        principalBasis,
        annualInterestRateBps,
        createdAt: new Date().toISOString(),
        dayCountBasis: this.dayCountBasis
      });

      await this.postgresAdapter.createInterestAccrual(accrual);
      await this.loanEvents.emitLoanInterestAccrued({
        accrual,
        correlationId
      });

      processed += 1;
      this.metrics.recordAccrualProcessed();
    }

    this.logger.info(
      {
        accrualMode: input.accrualMode,
        accrualDate: normalizedAccrualDate,
        correlationId,
        scanned: loans.length,
        processed,
        duplicatesSkipped,
        inactiveSkipped,
        failures
      },
      'Completed loan interest accrual run'
    );

    return {
      scanned: loans.length,
      processed,
      duplicatesSkipped,
      inactiveSkipped,
      failures,
      monthlyBoundarySkipped: false
    };
  }
}

function normalizeAccrualDate(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function isMonthlyBoundary(accrualDate: string): boolean {
  const date = new Date(`${accrualDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const boundary = new Date(date.toISOString());
  boundary.setUTCMonth(boundary.getUTCMonth() + 1, 0);
  return date.getUTCDate() === boundary.getUTCDate();
}

export type { LoanInterestAccrual };
