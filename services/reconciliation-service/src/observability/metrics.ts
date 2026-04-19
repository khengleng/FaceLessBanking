import { Counter } from 'prom-client';

export const reconciliationJobsStarted = new Counter({
  name: 'reconciliation_jobs_started_total',
  help: 'Total number of reconciliation jobs started',
  labelNames: ['job_type']
});

export const reconciliationJobsCompleted = new Counter({
  name: 'reconciliation_jobs_completed_total',
  help: 'Total number of reconciliation jobs completed',
  labelNames: ['job_type']
});

export const reconciliationJobsFailed = new Counter({
  name: 'reconciliation_jobs_failed_total',
  help: 'Total number of reconciliation jobs failed',
  labelNames: ['job_type']
});

export const mismatchDetectedCount = new Counter({
  name: 'reconciliation_mismatches_total',
  help: 'Total number of reconciliation mismatches detected',
  labelNames: ['job_type', 'entity_type']
});
