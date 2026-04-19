export type ReconciliationJobType = 
  | 'PAYMENT_STATUS_RECON' 
  | 'BALANCE_SNAPSHOT_RECON' 
  | 'LOAN_STATUS_RECON';

export type ReconciliationJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type ReconciliationJob = {
  jobId: string;
  jobType: ReconciliationJobType;
  status: ReconciliationJobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
};

export type MismatchType = 'MISSING_IN_TARGET' | 'MISSING_IN_SOURCE' | 'DATA_MISMATCH';

export type ReconciliationMismatch = {
  mismatchId: string;
  jobId: string;
  entityType: string;
  entityId: string;
  expectedValue: string;
  actualValue: string;
  mismatchType: MismatchType;
  createdAt: string;
};

export type ReconciliationJobWithSummary = {
  job: ReconciliationJob;
  mismatchCount: number;
  mismatches: ReconciliationMismatch[];
};

export function buildReconciliationJob(input: {
  jobId: string;
  jobType: ReconciliationJobType;
  createdAt: string;
}): ReconciliationJob {
  return {
    jobId: input.jobId,
    jobType: input.jobType,
    status: 'PENDING',
    createdAt: input.createdAt
  };
}
