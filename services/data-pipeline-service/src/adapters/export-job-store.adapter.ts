import type { ExportJob } from '../domain/data-pipeline.js';

export class ExportJobStoreAdapter {
  private readonly jobs = new Map<string, ExportJob>();

  async saveJob(job: ExportJob): Promise<void> {
    this.jobs.set(job.jobId, structuredClone(job));
  }

  async getJobById(jobId: string): Promise<ExportJob | null> {
    const job = this.jobs.get(jobId);
    return job ? structuredClone(job) : null;
  }
}

