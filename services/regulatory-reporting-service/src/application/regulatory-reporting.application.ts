import type { KafkaRegulatoryAdapter } from '../adapters/kafka-regulatory.adapter.js';
import type { PostgresRegulatoryAdapter } from '../adapters/postgres-regulatory.adapter.js';
import type { SourceDataAdapter } from '../adapters/source-data.adapter.js';
import type { RegulatoryReport, RegulatoryReportType } from '../domain/regulatory-report.js';
import type { RegulatoryReportingMetrics } from '../events/metrics.js';

type Logger = {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

export type GenerateReportInput = {
  reportType: unknown;
  businessDate: unknown;
  dateRangeStart: unknown;
  dateRangeEnd: unknown;
  generatedBy: unknown;
  idempotencyKey: string | undefined;
  correlationId: string;
};

export type GenerateReportResult =
  | { kind: 'generated'; report: RegulatoryReport }
  | { kind: 'invalid'; errors: string[] };

export class RegulatoryReportingApplication {
  constructor(
    private readonly postgresAdapter: PostgresRegulatoryAdapter,
    private readonly sourceDataAdapter: SourceDataAdapter,
    private readonly kafkaAdapter: KafkaRegulatoryAdapter,
    private readonly metrics: RegulatoryReportingMetrics,
    private readonly logger: Logger
  ) {}

  async listReports(): Promise<RegulatoryReport[]> {
    const reports = await this.postgresAdapter.listRegulatoryReports();
    return reports.map(sanitizeReport);
  }

  async getReportById(reportId: string): Promise<RegulatoryReport | null> {
    const report = await this.postgresAdapter.getRegulatoryReportById(reportId);
    return report ? sanitizeReport(report) : null;
  }

  async generateReport(input: GenerateReportInput): Promise<GenerateReportResult> {
    const validation = validateGenerateInput(input);
    if (validation.errors.length > 0) {
      return { kind: 'invalid', errors: validation.errors };
    }

    const startedAt = Date.now();
    const scope = 'regulatory_generate';

    const idempotent = await this.postgresAdapter.getIdempotencyResult(scope, validation.idempotencyKey);
    if (idempotent) {
      const prior = await this.postgresAdapter.getRegulatoryReportById(idempotent.reportId);
      if (prior) {
        this.logger.info(
          { reportId: prior.reportId, correlationId: input.correlationId },
          'Returning idempotent regulatory report result'
        );
        return { kind: 'generated', report: sanitizeReport(prior) };
      }
    }

    const deterministicKey = buildDeterministicKey({
      reportType: validation.reportType,
      businessDate: validation.businessDate,
      dateRangeStart: validation.dateRangeStart,
      dateRangeEnd: validation.dateRangeEnd
    });

    const existingReportId = await this.postgresAdapter.getReportIdByDeterministicKey(deterministicKey);
    if (existingReportId) {
      const existing = await this.postgresAdapter.getRegulatoryReportById(existingReportId);
      if (existing) {
        await this.postgresAdapter.setIdempotencyResult(scope, validation.idempotencyKey, {
          reportId: existing.reportId
        });
        return { kind: 'generated', report: sanitizeReport(existing) };
      }
    }

    const created = await this.postgresAdapter.createRegulatoryReport(
      {
        reportType: validation.reportType,
        businessDate: validation.businessDate,
        dateRangeStart: validation.dateRangeStart,
        dateRangeEnd: validation.dateRangeEnd,
        generatedBy: validation.generatedBy,
        metadata: {
          outputFormat: 'json',
          deterministicKey
        }
      },
      deterministicKey
    );

    try {
      const records = await this.fetchSourceRecords({
        reportType: validation.reportType,
        businessDate: validation.businessDate,
        dateRangeStart: validation.dateRangeStart,
        dateRangeEnd: validation.dateRangeEnd
      });

      const updated = await this.postgresAdapter.updateRegulatoryReportStatus({
        reportId: created.reportId,
        status: 'GENERATED',
        outputLocation: `regulatory://reports/${created.reportId}.json`,
        recordCount: records.length,
        metadataPatch: {
          recordCount: records.length,
          generatedDeterministically: true
        }
      });

      if (!updated) {
        return { kind: 'generated', report: sanitizeReport(created) };
      }

      await this.postgresAdapter.setIdempotencyResult(scope, validation.idempotencyKey, {
        reportId: updated.reportId
      });
      await this.kafkaAdapter.publishRegulatoryReportGenerated({
        report: updated,
        correlationId: input.correlationId
      });

      this.metrics.recordGenerated(validation.reportType, Date.now() - startedAt);

      this.logger.info(
        {
          reportId: updated.reportId,
          reportType: updated.reportType,
          correlationId: input.correlationId
        },
        'Generated regulatory report successfully'
      );

      return { kind: 'generated', report: sanitizeReport(updated) };
    } catch (error: unknown) {
      const failed = await this.postgresAdapter.updateRegulatoryReportStatus({
        reportId: created.reportId,
        status: 'FAILED',
        outputLocation: null,
        recordCount: 0,
        metadataPatch: {
          errorCode: 'GENERATION_FAILED',
          errorMessage: error instanceof Error ? error.message : 'unknown_error'
        }
      });

      const failureReport = failed ?? created;

      await this.postgresAdapter.setIdempotencyResult(scope, validation.idempotencyKey, {
        reportId: failureReport.reportId
      });
      await this.kafkaAdapter.publishRegulatoryReportFailed({
        report: failureReport,
        correlationId: input.correlationId
      });

      this.metrics.recordFailed(validation.reportType, Date.now() - startedAt);
      this.logger.error(
        {
          reportId: failureReport.reportId,
          reportType: failureReport.reportType,
          correlationId: input.correlationId,
          error: error instanceof Error ? error.message : 'unknown_error'
        },
        'Failed to generate regulatory report'
      );

      return { kind: 'generated', report: sanitizeReport(failureReport) };
    }
  }

  private async fetchSourceRecords(input: {
    reportType: RegulatoryReportType;
    businessDate: string | null;
    dateRangeStart: string | null;
    dateRangeEnd: string | null;
  }): Promise<Array<Record<string, string | number | boolean | null>>> {
    switch (input.reportType) {
      case 'TRANSACTION_REPORT':
        return this.sourceDataAdapter.fetchTransactionsForReport(input);
      case 'AML_REPORT':
        return this.sourceDataAdapter.fetchAmlAlertsForReport(input);
      case 'CAPITAL_REPORT':
        return this.sourceDataAdapter.fetchCapitalMetricsForReport(input);
    }
  }
}

function validateGenerateInput(input: GenerateReportInput): {
  errors: string[];
  reportType: RegulatoryReportType;
  businessDate: string | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  generatedBy: string;
  idempotencyKey: string;
} {
  const errors: string[] = [];

  const reportType = normalizeReportType(input.reportType);
  if (!reportType) {
    errors.push('reportType must be one of: TRANSACTION_REPORT, AML_REPORT, CAPITAL_REPORT');
  }

  const businessDate = normalizeOptionalIsoString(input.businessDate);
  const dateRangeStart = normalizeOptionalIsoString(input.dateRangeStart);
  const dateRangeEnd = normalizeOptionalIsoString(input.dateRangeEnd);

  if (!businessDate && (!dateRangeStart || !dateRangeEnd)) {
    errors.push('businessDate or dateRangeStart/dateRangeEnd is required');
  }

  if (dateRangeStart && dateRangeEnd && dateRangeStart > dateRangeEnd) {
    errors.push('dateRangeStart must be less than or equal to dateRangeEnd');
  }

  const generatedBy = typeof input.generatedBy === 'string' && input.generatedBy.trim().length > 0
    ? input.generatedBy.trim()
    : 'system';

  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey) {
    errors.push('idempotency-key header is required');
  }

  return {
    errors,
    reportType: reportType ?? 'TRANSACTION_REPORT',
    businessDate,
    dateRangeStart,
    dateRangeEnd,
    generatedBy,
    idempotencyKey: idempotencyKey ?? ''
  };
}

function normalizeReportType(value: unknown): RegulatoryReportType | null {
  if (value === 'TRANSACTION_REPORT' || value === 'AML_REPORT' || value === 'CAPITAL_REPORT') {
    return value;
  }

  return null;
}

function normalizeOptionalIsoString(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function normalizeIdempotencyKey(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildDeterministicKey(input: {
  reportType: RegulatoryReportType;
  businessDate: string | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
}): string {
  return [
    input.reportType,
    input.businessDate ?? '',
    input.dateRangeStart ?? '',
    input.dateRangeEnd ?? ''
  ].join('|');
}

function sanitizeReport(report: RegulatoryReport): RegulatoryReport {
  const metadata = { ...report.metadata };

  // Avoid exposing unsafe internals in phase 1 report metadata.
  delete metadata.errorMessage;

  return {
    ...report,
    metadata
  };
}
