import type { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import type { LoanEventsPublisher } from '../events/loan.events.js';
import { LoanInterestAccrualScheduler } from '../events/loan-interest-accrual.scheduler.js';
import { LoanInterestAccrualMetrics } from '../events/metrics.js';

import { LoanInterestAccrualApplication } from './loan-interest-accrual.application.js';

export function buildLoanInterestAccrualApplication(deps: {
  postgresAdapter: PostgresLoanAdapter;
  loanEvents: LoanEventsPublisher;
  metrics?: LoanInterestAccrualMetrics;
  defaultAnnualInterestRateBps?: number;
  dayCountBasis?: number;
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
  };
}): {
  application: LoanInterestAccrualApplication;
  scheduler: LoanInterestAccrualScheduler;
  metrics: LoanInterestAccrualMetrics;
} {
  const metrics = deps.metrics ?? new LoanInterestAccrualMetrics();
  const logger = deps.logger ?? {
    info: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    },
    warn: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    },
    error: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    }
  };

  const application = new LoanInterestAccrualApplication(
    deps.postgresAdapter,
    deps.loanEvents,
    metrics,
    logger,
    deps.defaultAnnualInterestRateBps ?? 1200,
    deps.dayCountBasis ?? 365
  );

  const scheduler = new LoanInterestAccrualScheduler(application);

  return {
    application,
    scheduler,
    metrics
  };
}
