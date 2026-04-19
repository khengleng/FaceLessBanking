import type { DailyCloseRun, DailyCloseJobExecution, BatchRunWithJobs, BatchStatus } from '../domain/batch.js';

export class PostgresBatchAdapter {
  private readonly runs = new Map<string, DailyCloseRun>();
  private readonly jobs = new Map<string, DailyCloseJobExecution[]>();
  private readonly runIdByDate = new Map<string, string>();

  async getRunByBusinessDate(businessDate: string): Promise<DailyCloseRun | null> {
    const runId = this.runIdByDate.get(businessDate);
    return runId ? (this.runs.get(runId) ?? null) : null;
  }

  async createRun(run: DailyCloseRun): Promise<void> {
    this.runs.set(run.runId, run);
    this.runIdByDate.set(run.businessDate, run.runId);
  }

  async updateRunStatus(runId: string, status: BatchStatus, errorMessage?: string): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      this.runs.set(runId, {
        ...run,
        status,
        errorMessage,
        completedAt: ['COMPLETED', 'FAILED'].includes(status) ? new Date().toISOString() : undefined
      });
    }
  }

  async createJobExecution(job: DailyCloseJobExecution): Promise<void> {
    const runJobs = this.jobs.get(job.runId) || [];
    runJobs.push(job);
    this.jobs.set(job.runId, runJobs);
  }

  async updateJobExecutionStatus(
    runId: string, 
    jobName: string, 
    status: BatchStatus, 
    errorMessage?: string
  ): Promise<void> {
    const runJobs = this.jobs.get(runId);
    if (runJobs) {
      const jobIdx = runJobs.findIndex(j => j.jobName === jobName);
      if (jobIdx !== -1) {
        runJobs[jobIdx] = {
          ...runJobs[jobIdx],
          status,
          errorMessage,
          completedAt: ['COMPLETED', 'FAILED'].includes(status) ? new Date().toISOString() : undefined
        };
      }
    }
  }

  async getRunWithJobs(runId: string): Promise<BatchRunWithJobs | null> {
    const run = this.runs.get(runId);
    if (!run) return null;
    return {
      run,
      jobs: this.jobs.get(runId) || []
    };
  }
}
