import type { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import type { WorkflowAdapter } from '../adapters/workflow.adapter.js';
import { canTransitionLoanStatus } from '../domain/loan.js';
import type { LoanEventsPublisher } from '../events/loan.events.js';
import type { LoanDelinquencyMetrics } from '../events/metrics.js';

export type RunDelinquencyDetectionResult = {
  scanned: number;
  markedDelinquent: number;
  duplicateSkipped: number;
};

export class LoanDelinquencyApplication {
  constructor(
    private readonly postgresAdapter: PostgresLoanAdapter,
    private readonly workflowAdapter: WorkflowAdapter,
    private readonly loanEvents: LoanEventsPublisher,
    private readonly metrics: LoanDelinquencyMetrics,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async runDetection(correlationId: string): Promise<RunDelinquencyDetectionResult> {
    const overdueLoans = await this.postgresAdapter.findOverdueLoans();
    if (overdueLoans.length === 0) {
      this.metrics.recordEmptyOverdueDatasetRun();
      this.logger.info({ correlationId }, 'No overdue loans found for delinquency run');
      return {
        scanned: 0,
        markedDelinquent: 0,
        duplicateSkipped: 0
      };
    }

    let markedDelinquent = 0;
    let duplicateSkipped = 0;

    for (const loan of overdueLoans) {
      if (loan.status !== 'ACTIVE' || !canTransitionLoanStatus(loan.status, 'DELINQUENT')) {
        duplicateSkipped += 1;
        this.metrics.recordDuplicateDelinquencySkipped();
        this.logger.warn(
          { correlationId, loanAccountId: loan.loanId, status: loan.status },
          'Skipping delinquency update due to invalid state transition'
        );
        continue;
      }

      await this.postgresAdapter.updateLoanStatus(loan.loanId, 'DELINQUENT');
      await this.workflowAdapter.createCollectionsCase({
        loanAccountId: loan.loanId,
        customerId: loan.customerId,
        reason: 'repayment_missing_placeholder_rule',
        correlationId
      });
      await this.loanEvents.emitLoanDelinquent({
        loanAccountId: loan.loanId,
        customerId: loan.customerId,
        correlationId,
        reason: 'repayment_missing_placeholder_rule'
      });

      markedDelinquent += 1;
      this.metrics.recordDelinquentLoanMarked();
    }

    this.logger.info(
      {
        correlationId,
        scanned: overdueLoans.length,
        markedDelinquent,
        duplicateSkipped
      },
      'Completed delinquency detection run'
    );

    return {
      scanned: overdueLoans.length,
      markedDelinquent,
      duplicateSkipped
    };
  }
}
