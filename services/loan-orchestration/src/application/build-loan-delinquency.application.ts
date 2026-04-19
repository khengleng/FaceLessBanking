import type { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import { WorkflowAdapterStub, type WorkflowAdapter } from '../adapters/workflow.adapter.js';
import type { LoanEventsPublisher } from '../events/loan.events.js';
import { LoanDelinquencyMetrics } from '../events/metrics.js';

import { LoanDelinquencyApplication } from './loan-delinquency.application.js';

export function buildLoanDelinquencyApplication(deps: {
  postgresAdapter: PostgresLoanAdapter;
  loanEvents: LoanEventsPublisher;
  workflowAdapter?: WorkflowAdapter;
  metrics?: LoanDelinquencyMetrics;
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
  };
}): {
  application: LoanDelinquencyApplication;
  workflowAdapter: WorkflowAdapter;
  metrics: LoanDelinquencyMetrics;
} {
  const workflowAdapter = deps.workflowAdapter ?? new WorkflowAdapterStub();
  const metrics = deps.metrics ?? new LoanDelinquencyMetrics();
  const logger = deps.logger ?? {
    info: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    },
    warn: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    }
  };

  const application = new LoanDelinquencyApplication(
    deps.postgresAdapter,
    workflowAdapter,
    deps.loanEvents,
    metrics,
    logger
  );

  return {
    application,
    workflowAdapter,
    metrics
  };
}
