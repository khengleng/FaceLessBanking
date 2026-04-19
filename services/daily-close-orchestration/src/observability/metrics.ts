import { Counter } from 'prom-client';

// Placeholders for OpenTelemetry/Prometheus metrics
export const dailyCloseRunsStarted = new Counter({
  name: 'daily_close_runs_started_total',
  help: 'Total number of daily close runs started',
  labelNames: ['business_date']
});

export const dailyCloseRunsCompleted = new Counter({
  name: 'daily_close_runs_completed_total',
  help: 'Total number of daily close runs completed',
  labelNames: ['business_date']
});

export const dailyCloseRunsFailed = new Counter({
  name: 'daily_close_runs_failed_total',
  help: 'Total number of daily close runs failed',
  labelNames: ['business_date']
});

export const dailyCloseJobExecutionCount = new Counter({
  name: 'daily_close_job_execution_total',
  help: 'Total number of daily close job executions',
  labelNames: ['job_name', 'status']
});
