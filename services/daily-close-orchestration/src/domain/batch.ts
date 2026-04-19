export type BatchStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface DailyCloseRun {
  runId: string;
  businessDate: string; // YYYY-MM-DD
  status: BatchStatus;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface DailyCloseJobExecution {
  executionId: string;
  runId: string;
  jobName: string;
  status: BatchStatus;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface BatchRunWithJobs {
  run: DailyCloseRun;
  jobs: DailyCloseJobExecution[];
}

export const BATCH_JOBS_SEQUENCE = [
  'loan_interest_accrual',
  'deposit_interest_accrual',
  'delinquency_scan',
  'accounting_close_placeholder'
] as const;

export type BatchJobName = typeof BATCH_JOBS_SEQUENCE[number];
