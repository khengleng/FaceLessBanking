import type {
  AnalyticsDataset,
  AnalyticsTarget,
  SourceRecord
} from '../domain/data-pipeline.js';

export class ExportFormatAdapter {
  format(
    target: AnalyticsTarget,
    dataset: AnalyticsDataset,
    rows: SourceRecord[]
  ): SourceRecord[] {
    if (target === 'dashboard') {
      return rows.map((row) => this.toDashboardRow(dataset, row));
    }

    return rows.map((row) => this.toBIRow(dataset, row));
  }

  private toBIRow(dataset: AnalyticsDataset, row: SourceRecord): SourceRecord {
    return {
      dataset,
      ...row
    };
  }

  private toDashboardRow(dataset: AnalyticsDataset, row: SourceRecord): SourceRecord {
    switch (dataset) {
      case 'customers':
        return {
          customerId: row.customerId ?? null,
          status: row.status ?? null,
          createdAt: row.createdAt ?? null
        };
      case 'accounts':
        return {
          accountId: row.accountId ?? null,
          status: row.status ?? null,
          currency: row.currency ?? null
        };
      case 'payments':
        return {
          paymentId: row.paymentId ?? null,
          amount: row.amount ?? null,
          currency: row.currency ?? null,
          status: row.status ?? null
        };
      case 'loans':
        return {
          loanId: row.loanId ?? null,
          status: row.status ?? null,
          principalAmount: row.principalAmount ?? null,
          currency: row.currency ?? null
        };
      case 'profitability':
        return {
          entityType: row.entityType ?? null,
          entityId: row.entityId ?? null,
          netProfit: row.netProfit ?? null,
          currency: row.currency ?? null
        };
      default:
        return row;
    }
  }
}
