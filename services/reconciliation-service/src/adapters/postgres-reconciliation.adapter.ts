import type { 
  ReconciliationJob, 
  ReconciliationJobStatus, 
  ReconciliationMismatch
} from '../domain/reconciliation-job.js';

export class PostgresReconciliationAdapter {
  private readonly jobs = new Map<string, ReconciliationJob>();
  private readonly mismatches = new Map<string, ReconciliationMismatch[]>();
  private readonly processedRuns = new Set<string>();

  async createReconciliationJob(job: ReconciliationJob): Promise<void> {
    this.jobs.set(job.jobId, job);
  }

  async getReconciliationJob(jobId: string): Promise<ReconciliationJob | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async updateReconciliationJobStatus(
    jobId: string, 
    status: ReconciliationJobStatus, 
    errorMessage?: string
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      this.jobs.set(jobId, {
        ...job,
        status,
        errorMessage,
        startedAt: status === 'RUNNING' ? new Date().toISOString() : job.startedAt,
        completedAt: ['COMPLETED', 'FAILED'].includes(status) ? new Date().toISOString() : job.completedAt
      });
    }
  }

  async createReconciliationMismatch(mismatch: ReconciliationMismatch): Promise<void> {
    const jobMismatches = this.mismatches.get(mismatch.jobId) || [];
    jobMismatches.push(mismatch);
    this.mismatches.set(mismatch.jobId, jobMismatches);
  }

  async listReconciliationMismatchesByJob(jobId: string): Promise<ReconciliationMismatch[]> {
    return this.mismatches.get(jobId) || [];
  }

  async hasProcessedReconciliationRun(jobId: string): Promise<boolean> {
    return this.processedRuns.has(jobId);
  }

  async markReconciliationRunProcessed(jobId: string): Promise<void> {
    this.processedRuns.add(jobId);
  }
}
