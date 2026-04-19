export type RegulatoryReportType = 'TRANSACTION' | 'AML' | 'CAPITAL';

export interface RegulatoryReport {
  reportId: string;
  type: RegulatoryReportType;
  generatedAt: string;
  data: Record<string, number | string | boolean>;
}

export interface ReportGenerationInput {
  type: RegulatoryReportType;
}
