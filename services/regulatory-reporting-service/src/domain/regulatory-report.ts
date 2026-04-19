export type RegulatoryReportType =
  | 'TRANSACTION_REPORT'
  | 'AML_REPORT'
  | 'CAPITAL_REPORT';

export type RegulatoryReportStatus = 'PENDING' | 'GENERATED' | 'FAILED';

export type RegulatoryReport = {
  reportId: string;
  reportType: RegulatoryReportType;
  businessDate: string | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  status: RegulatoryReportStatus;
  generatedAt: string;
  generatedBy: string;
  outputLocation: string | null;
  recordCount: number;
  metadata: Record<string, string | number | boolean | null>;
};

export type CreateRegulatoryReportInput = {
  reportType: RegulatoryReportType;
  businessDate: string | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  generatedBy: string;
  metadata: Record<string, string | number | boolean | null>;
};
