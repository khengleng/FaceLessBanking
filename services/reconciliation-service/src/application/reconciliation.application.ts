import { randomUUID } from 'node:crypto';
import type { PostgresReconciliationAdapter } from '../adapters/postgres-reconciliation.adapter.js';
import type { ReconciliationEventsPublisher } from '../events/reconciliation-publisher.adapter.js';
import { 
  buildReconciliationJob, 
  type ReconciliationJob, 
  type ReconciliationJobType, 
  type ReconciliationMismatch,
  type ReconciliationJobWithSummary
} from '../domain/reconciliation-job.js';
import { 
  reconciliationJobsStarted, 
  reconciliationJobsCompleted, 
  reconciliationJobsFailed, 
  mismatchDetectedCount 
} from '../observability/metrics.js';

export class ReconciliationApplication {
  constructor(
    private readonly postgresAdapter: PostgresReconciliationAdapter,
    private readonly eventPublisher: ReconciliationEventsPublisher,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async createJob(jobType: ReconciliationJobType): Promise<ReconciliationJob> {
    const job = buildReconciliationJob({
      jobId: randomUUID(),
      jobType,
      createdAt: new Date().toISOString()
    });

    await this.postgresAdapter.createReconciliationJob(job);
    return job;
  }

  async getJobDetails(jobId: string): Promise<ReconciliationJobWithSummary | null> {
    const job = await this.postgresAdapter.getReconciliationJob(jobId);
    if (!job) return null;

    const mismatches = await this.postgresAdapter.listReconciliationMismatchesByJob(jobId);
    return {
      job,
      mismatchCount: mismatches.length,
      mismatches
    };
  }

  async runJob(jobId: string, correlationId?: string): Promise<void> {
    const job = await this.postgresAdapter.getReconciliationJob(jobId);
    if (!job) throw new Error('Job not found');

    if (job.status === 'RUNNING') {
      throw new Error('Job already running');
    }

    // Idempotency check for COMPLETED runs
    const alreadyProcessed = await this.postgresAdapter.hasProcessedReconciliationRun(jobId);
    if (alreadyProcessed) {
      this.logger.warn({ jobId }, 'Reconciliation run already processed for this job ID.');
      return;
    }

    await this.postgresAdapter.updateReconciliationJobStatus(jobId, 'RUNNING');
    await this.eventPublisher.emitJobStarted(job, correlationId);
    
    reconciliationJobsStarted.inc({ job_type: job.jobType });

    // Run in background
    this.executeReconciliation(jobId, correlationId).catch(err => {
      this.logger.error({ err, jobId }, 'Background reconciliation failed unexpectedly');
    });
  }

  private async executeReconciliation(jobId: string, correlationId?: string): Promise<void> {
    try {
      const job = await this.postgresAdapter.getReconciliationJob(jobId);
      if (!job) return;

      this.logger.info({ jobId, type: job.jobType }, 'Starting reconciliation handler');

      let detectedMismatches: ReconciliationMismatch[] = [];

      switch (job.jobType) {
        case 'PAYMENT_STATUS_RECON':
          detectedMismatches = await this.handlePaymentRecon(jobId);
          break;
        case 'BALANCE_SNAPSHOT_RECON':
          detectedMismatches = await this.handleBalanceRecon(jobId);
          break;
        case 'LOAN_STATUS_RECON':
          detectedMismatches = await this.handleLoanRecon(jobId);
          break;
      }

      for (const m of detectedMismatches) {
        await this.postgresAdapter.createReconciliationMismatch(m);
        await this.eventPublisher.emitMismatchDetected(m, correlationId);
        mismatchDetectedCount.inc({ job_type: job.jobType, entity_type: m.entityType });
      }

      await this.postgresAdapter.updateReconciliationJobStatus(jobId, 'COMPLETED');
      await this.postgresAdapter.markReconciliationRunProcessed(jobId);

      reconciliationJobsCompleted.inc({ job_type: job.jobType });

      const completedJob = await this.postgresAdapter.getReconciliationJob(jobId);
      if (completedJob) {
        await this.eventPublisher.emitJobCompleted(completedJob, detectedMismatches.length, correlationId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'reconciliation_execution_failed';
      this.logger.error({ err: message, jobId }, 'Reconciliation logic failed');
      await this.postgresAdapter.updateReconciliationJobStatus(jobId, 'FAILED', message);
      
      const job = await this.postgresAdapter.getReconciliationJob(jobId);
      if (job) {
        reconciliationJobsFailed.inc({ job_type: job.jobType });
      }
    }
  }

  private async handlePaymentRecon(jobId: string): Promise<ReconciliationMismatch[]> {
    void jobId;
    // Placeholder logic for PAYMENT_STATUS_RECON
    return []; 
  }

  private async handleBalanceRecon(jobId: string): Promise<ReconciliationMismatch[]> {
    void jobId;
    // Placeholder logic for BALANCE_SNAPSHOT_RECON
    return [];
  }

  private async handleLoanRecon(jobId: string): Promise<ReconciliationMismatch[]> {
    void jobId;
    // Placeholder logic for LOAN_STATUS_RECON
    return [];
  }
}
