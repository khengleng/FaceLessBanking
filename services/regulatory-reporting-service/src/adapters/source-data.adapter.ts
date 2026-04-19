import type { RegulatoryReportType } from '../domain/regulatory-report.js';

export class SourceDataAdapter {
  private failOnReportType: RegulatoryReportType | null = null;

  async fetchTransactionsForReport(input: {
    businessDate: string | null;
    dateRangeStart: string | null;
    dateRangeEnd: string | null;
  }): Promise<Array<Record<string, string | number | boolean | null>>> {
    void input;
    this.maybeFail('TRANSACTION_REPORT');

    return [
      {
        transactionId: 'txn-001',
        amount: 120.5,
        currency: 'USD',
        status: 'COMPLETED'
      },
      {
        transactionId: 'txn-002',
        amount: 75,
        currency: 'USD',
        status: 'FAILED'
      }
    ];
  }

  async fetchAmlAlertsForReport(input: {
    businessDate: string | null;
    dateRangeStart: string | null;
    dateRangeEnd: string | null;
  }): Promise<Array<Record<string, string | number | boolean | null>>> {
    void input;
    this.maybeFail('AML_REPORT');

    return [
      {
        alertId: 'aml-001',
        severity: 'HIGH',
        status: 'OPEN'
      }
    ];
  }

  async fetchCapitalMetricsForReport(input: {
    businessDate: string | null;
    dateRangeStart: string | null;
    dateRangeEnd: string | null;
  }): Promise<Array<Record<string, string | number | boolean | null>>> {
    void input;
    this.maybeFail('CAPITAL_REPORT');

    return [
      {
        metric: 'CAR',
        value: 0.13,
        currency: 'USD'
      },
      {
        metric: 'RWA',
        value: 10000,
        currency: 'USD'
      }
    ];
  }

  setFailOnReportType(reportType: RegulatoryReportType | null): void {
    this.failOnReportType = reportType;
  }

  private maybeFail(reportType: RegulatoryReportType): void {
    if (this.failOnReportType === reportType) {
      throw new Error(`source_data_unavailable_for_${reportType}`);
    }
  }
}
