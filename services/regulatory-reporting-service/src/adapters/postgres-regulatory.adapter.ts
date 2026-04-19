import { randomUUID } from 'node:crypto';

import type {
  CreateRegulatoryReportInput,
  RegulatoryReport,
  RegulatoryReportStatus
} from '../domain/regulatory-report.js';

export class PostgresRegulatoryAdapter {
  private readonly reports = new Map<string, RegulatoryReport>();

  private readonly deterministicByInput = new Map<string, string>();

  private readonly idempotencyResults = new Map<string, { reportId: string }>();

  async createRegulatoryReport(
    input: CreateRegulatoryReportInput,
    deterministicKey: string
  ): Promise<RegulatoryReport> {
    const report: RegulatoryReport = {
      reportId: randomUUID(),
      reportType: input.reportType,
      businessDate: input.businessDate,
      dateRangeStart: input.dateRangeStart,
      dateRangeEnd: input.dateRangeEnd,
      status: 'PENDING',
      generatedAt: new Date().toISOString(),
      generatedBy: input.generatedBy,
      outputLocation: null,
      recordCount: 0,
      metadata: {
        ...input.metadata
      }
    };

    this.reports.set(report.reportId, report);
    this.deterministicByInput.set(deterministicKey, report.reportId);
    return structuredClone(report);
  }

  async getRegulatoryReportById(reportId: string): Promise<RegulatoryReport | null> {
    const report = this.reports.get(reportId);
    return report ? structuredClone(report) : null;
  }

  async listRegulatoryReports(): Promise<RegulatoryReport[]> {
    return Array.from(this.reports.values())
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
      .map((report) => structuredClone(report));
  }

  async updateRegulatoryReportStatus(input: {
    reportId: string;
    status: RegulatoryReportStatus;
    outputLocation: string | null;
    recordCount: number;
    metadataPatch?: Record<string, string | number | boolean | null>;
  }): Promise<RegulatoryReport | null> {
    const existing = this.reports.get(input.reportId);
    if (!existing) {
      return null;
    }

    const updated: RegulatoryReport = {
      ...existing,
      status: input.status,
      outputLocation: input.outputLocation,
      recordCount: input.recordCount,
      metadata: {
        ...existing.metadata,
        ...(input.metadataPatch ?? {})
      }
    };

    this.reports.set(updated.reportId, updated);
    return structuredClone(updated);
  }

  async getReportIdByDeterministicKey(key: string): Promise<string | null> {
    return this.deterministicByInput.get(key) ?? null;
  }

  async getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ reportId: string } | null> {
    return this.idempotencyResults.get(`${scope}:${idempotencyKey}`) ?? null;
  }

  async setIdempotencyResult(scope: string, idempotencyKey: string, value: { reportId: string }): Promise<void> {
    this.idempotencyResults.set(`${scope}:${idempotencyKey}`, value);
  }
}
