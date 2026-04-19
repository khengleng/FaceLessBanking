import crypto from 'node:crypto';

import type {
  RegulatoryReport,
  ReportGenerationInput
} from '../domain/regulatory-report.js';

export interface ReportDataAdapter {
  getTransactionSnapshot(): Promise<{ transactionCount: number; totalAmount: number }>;
  getAmlSnapshot(): Promise<{ suspiciousAlerts: number; blockedTransactions: number }>;
  getCapitalSnapshot(): Promise<{ totalRwa: number; capitalBase: number; car: number }>;
}

export interface ReportStoreAdapter {
  listReports(): Promise<RegulatoryReport[]>;
  createReport(input: ReportGenerationInput & { data: Record<string, number | string | boolean> }): Promise<RegulatoryReport>;
  getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ reportId: string } | null>;
  setIdempotencyResult(scope: string, idempotencyKey: string, value: { reportId: string }): Promise<void>;
  getReportById(reportId: string): Promise<RegulatoryReport | null>;
}

export class InMemoryReportDataAdapter implements ReportDataAdapter {
  private transactionSnapshot = { transactionCount: 12, totalAmount: 2400 };

  private amlSnapshot = { suspiciousAlerts: 2, blockedTransactions: 1 };

  private capitalSnapshot = { totalRwa: 10000, capitalBase: 1300, car: 0.13 };

  async getTransactionSnapshot(): Promise<{ transactionCount: number; totalAmount: number }> {
    return this.transactionSnapshot;
  }

  async getAmlSnapshot(): Promise<{ suspiciousAlerts: number; blockedTransactions: number }> {
    return this.amlSnapshot;
  }

  async getCapitalSnapshot(): Promise<{ totalRwa: number; capitalBase: number; car: number }> {
    return this.capitalSnapshot;
  }

  setTransactionSnapshot(snapshot: { transactionCount: number; totalAmount: number }): void {
    this.transactionSnapshot = snapshot;
  }

  setAmlSnapshot(snapshot: { suspiciousAlerts: number; blockedTransactions: number }): void {
    this.amlSnapshot = snapshot;
  }

  setCapitalSnapshot(snapshot: { totalRwa: number; capitalBase: number; car: number }): void {
    this.capitalSnapshot = snapshot;
  }
}

export class InMemoryReportStoreAdapter implements ReportStoreAdapter {
  private readonly reports = new Map<string, RegulatoryReport>();

  private readonly idempotency = new Map<string, { reportId: string }>();

  async listReports(): Promise<RegulatoryReport[]> {
    return [...this.reports.values()].sort((a, b) => a.generatedAt.localeCompare(b.generatedAt));
  }

  async createReport(input: ReportGenerationInput & { data: Record<string, number | string | boolean> }): Promise<RegulatoryReport> {
    const report: RegulatoryReport = {
      reportId: crypto.randomUUID(),
      type: input.type,
      generatedAt: new Date().toISOString(),
      data: input.data
    };

    this.reports.set(report.reportId, report);
    return report;
  }

  async getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ reportId: string } | null> {
    return this.idempotency.get(`${scope}:${idempotencyKey}`) ?? null;
  }

  async setIdempotencyResult(scope: string, idempotencyKey: string, value: { reportId: string }): Promise<void> {
    this.idempotency.set(`${scope}:${idempotencyKey}`, value);
  }

  async getReportById(reportId: string): Promise<RegulatoryReport | null> {
    return this.reports.get(reportId) ?? null;
  }
}
