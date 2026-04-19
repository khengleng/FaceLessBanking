import type { ReconciliationJob, ReconciliationJobWithSummary } from '../../domain/reconciliation-job.js';

export type CreateReconciliationJobRequestDto = {
  jobType: string;
};

export type ReconciliationJobResponseDto = {
  jobId: string;
  jobType: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
};

export type ReconciliationJobDetailsResponseDto = {
  job: ReconciliationJobResponseDto;
  mismatchCount: number;
};

export function toReconciliationJobResponseDto(job: ReconciliationJob): ReconciliationJobResponseDto {
  return {
    jobId: job.jobId,
    jobType: job.jobType,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    errorMessage: job.errorMessage
  };
}

export function toReconciliationJobDetailsResponseDto(jobDetails: ReconciliationJobWithSummary): ReconciliationJobDetailsResponseDto {
  return {
    job: toReconciliationJobResponseDto(jobDetails.job),
    mismatchCount: jobDetails.mismatchCount
  };
}
