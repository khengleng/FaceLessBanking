import { randomUUID } from 'node:crypto';
import type { PostgresBatchAdapter } from '../adapters/postgres-batch.adapter.js';
import type { InternalJobsAdapter } from '../adapters/internal-jobs.adapter.js';
import type { BatchEventsPublisher } from '../events/batch-publisher.adapter.js';
import { 
  type BatchRunWithJobs, 
  type DailyCloseRun, 
  type DailyCloseJobExecution, 
  BATCH_JOBS_SEQUENCE 
} from '../domain/batch.js';
import { 
  dailyCloseRunsStarted, 
  dailyCloseRunsCompleted, 
  dailyCloseRunsFailed, 
  dailyCloseJobExecutionCount 
} from '../observability/metrics.js';

export interface RunDailyCloseResult {
  kind: 'started' | 'already_running' | 'already_completed' | 'error';
  runId?: string;
  reason?: string;
}

export class DailyCloseApplication {
  constructor(
    private readonly postgresAdapter: PostgresBatchAdapter,
    private readonly jobsAdapter: InternalJobsAdapter,
    private readonly batchPublisher: BatchEventsPublisher,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async runDailyClose(businessDate: string, correlationId?: string): Promise<RunDailyCloseResult> {
    const existingRun = await this.postgresAdapter.getRunByBusinessDate(businessDate);
    
    if (existingRun) {
      if (existingRun.status === 'RUNNING') return { kind: 'already_running', runId: existingRun.runId };
      if (existingRun.status === 'COMPLETED') return { kind: 'already_completed', runId: existingRun.runId };
      // For Phase 1, we don't automatically restart FAILED runs here, just return error
      if (existingRun.status === 'FAILED') return { kind: 'error', runId: existingRun.runId, reason: 'Previous run failed for this date' };
    }

    const runId = randomUUID();
    const run: DailyCloseRun = {
      runId,
      businessDate,
      status: 'RUNNING',
      startedAt: new Date().toISOString()
    };

    await this.postgresAdapter.createRun(run);
    await this.batchPublisher.emitDailyCloseStarted(run, correlationId);
    
    dailyCloseRunsStarted.inc({ business_date: businessDate });

    // Run orchestration in background
    this.executeJobs(run, correlationId).catch(err => {
      this.logger.error({ err, runId }, 'Unguarded error in batch execution background');
    });

    return { kind: 'started', runId };
  }

  async getRunDetails(runId: string): Promise<BatchRunWithJobs | null> {
    return this.postgresAdapter.getRunWithJobs(runId);
  }

  private async executeJobs(run: DailyCloseRun, correlationId?: string): Promise<void> {
    try {
      for (const jobName of BATCH_JOBS_SEQUENCE) {
        const execution: DailyCloseJobExecution = {
          executionId: randomUUID(),
          runId: run.runId,
          jobName,
          status: 'RUNNING',
          startedAt: new Date().toISOString()
        };

        await this.postgresAdapter.createJobExecution(execution);
        dailyCloseJobExecutionCount.inc({ job_name: jobName, status: 'RUNNING' });

        try {
          switch (jobName) {
            case 'loan_interest_accrual':
              await this.jobsAdapter.runLoanInterestAccrual(run.businessDate);
              break;
            case 'deposit_interest_accrual':
              await this.jobsAdapter.runDepositInterestAccrual(run.businessDate);
              break;
            case 'delinquency_scan':
              await this.jobsAdapter.runDelinquencyScan(run.businessDate);
              break;
            case 'accounting_close_placeholder':
              await this.jobsAdapter.runAccountingClosePlaceholder(run.businessDate);
              break;
          }

          await this.postgresAdapter.updateJobExecutionStatus(run.runId, jobName, 'COMPLETED');
          dailyCloseJobExecutionCount.inc({ job_name: jobName, status: 'COMPLETED' });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'job_execution_failed';
          await this.postgresAdapter.updateJobExecutionStatus(run.runId, jobName, 'FAILED', message);
          dailyCloseJobExecutionCount.inc({ job_name: jobName, status: 'FAILED' });
          throw new Error(`Job ${jobName} failed: ${message}`);
        }
      }

      await this.postgresAdapter.updateRunStatus(run.runId, 'COMPLETED');
      dailyCloseRunsCompleted.inc({ business_date: run.businessDate });
      
      const completedRun = await this.postgresAdapter.getRunWithJobs(run.runId);
      if (completedRun) {
        await this.batchPublisher.emitDailyCloseCompleted(completedRun.run, correlationId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'batch_execution_failed';
      this.logger.error({ err: message, runId: run.runId }, 'Batch execution failed');
      await this.postgresAdapter.updateRunStatus(run.runId, 'FAILED', message);
      dailyCloseRunsFailed.inc({ business_date: run.businessDate });
    }
  }
}
