import type {
  ReportDataAdapter,
  ReportStoreAdapter
} from '../adapters/regulatory-reporting.adapters.js';
import type { RegulatoryReport, RegulatoryReportType } from '../domain/regulatory-report.js';

type Logger = {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

export class RegulatoryReportingApplication {
  constructor(
    private readonly dataAdapter: ReportDataAdapter,
    private readonly storeAdapter: ReportStoreAdapter,
    private readonly logger: Logger
  ) {}

  async listReports(): Promise<RegulatoryReport[]> {
    return this.storeAdapter.listReports();
  }

  async generateReport(input: {
    type: RegulatoryReportType;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<RegulatoryReport> {
    const existing = await this.storeAdapter.getIdempotencyResult('regulatory-generate', input.idempotencyKey);
    if (existing) {
      const prior = await this.storeAdapter.getReportById(existing.reportId);
      if (prior) {
        this.logger.info({ reportId: prior.reportId, correlationId: input.correlationId }, 'Returning idempotent regulatory report result');
        return prior;
      }
    }

    const data = await this.buildReportData(input.type);
    const report = await this.storeAdapter.createReport({ type: input.type, data });

    await this.storeAdapter.setIdempotencyResult('regulatory-generate', input.idempotencyKey, {
      reportId: report.reportId
    });

    this.logger.info(
      { reportId: report.reportId, type: report.type, correlationId: input.correlationId },
      'Generated regulatory report'
    );

    return report;
  }

  private async buildReportData(type: RegulatoryReportType): Promise<Record<string, number | string | boolean>> {
    switch (type) {
      case 'TRANSACTION': {
        const snapshot = await this.dataAdapter.getTransactionSnapshot();
        return {
          transactionCount: snapshot.transactionCount,
          totalAmount: snapshot.totalAmount,
          accurate: true
        };
      }
      case 'AML': {
        const snapshot = await this.dataAdapter.getAmlSnapshot();
        return {
          suspiciousAlerts: snapshot.suspiciousAlerts,
          blockedTransactions: snapshot.blockedTransactions,
          accurate: true
        };
      }
      case 'CAPITAL': {
        const snapshot = await this.dataAdapter.getCapitalSnapshot();
        return {
          totalRwa: snapshot.totalRwa,
          capitalBase: snapshot.capitalBase,
          car: snapshot.car,
          accurate: true
        };
      }
    }
  }
}
