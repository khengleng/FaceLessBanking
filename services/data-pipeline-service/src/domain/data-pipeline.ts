export type AnalyticsTarget = 'bi' | 'dashboard';

export type AnalyticsDataset = 'customers' | 'accounts' | 'loans' | 'payments' | 'profitability';

export type ExportSinkType = 'bi-tool' | 'data-warehouse';

export type ExportTriggerType = 'MANUAL' | 'SCHEDULED';

export type ExportJobStatus = 'COMPLETED' | 'FAILED';

export type SourceRecord = Record<string, string | number | boolean | null>;

export type PipelineExport = {
  jobId: string;
  target: AnalyticsTarget;
  dataset: AnalyticsDataset;
  sinkType: ExportSinkType;
  generatedAt: string;
  rows: SourceRecord[];
};

export type ExportJob = {
  jobId: string;
  target: AnalyticsTarget;
  dataset: AnalyticsDataset;
  sinkType: ExportSinkType;
  triggerType: ExportTriggerType;
  status: ExportJobStatus;
  rowCount: number;
  createdAt: string;
  completedAt: string;
  sinkReference: string | null;
  errorMessage: string | null;
};

export function isAnalyticsTarget(value: string): value is AnalyticsTarget {
  return value === 'bi' || value === 'dashboard';
}

export function isAnalyticsDataset(value: string): value is AnalyticsDataset {
  return (
    value === 'customers'
    || value === 'accounts'
    || value === 'loans'
    || value === 'payments'
    || value === 'profitability'
  );
}
