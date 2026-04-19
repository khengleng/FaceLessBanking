import { randomUUID } from 'node:crypto';

import type { ExportFormatAdapter } from '../adapters/export-format.adapter.js';
import type { ExportJobStoreAdapter } from '../adapters/export-job-store.adapter.js';
import type { ExportSinkAdapter } from '../adapters/export-sink.adapter.js';
import type { SourceDataAdapter } from '../adapters/source-data.adapter.js';
import type { PipelineEventsAdapter } from '../events/pipeline-events.adapter.js';
import {
  type ExportJob,
  type ExportSinkType,
  type ExportTriggerType,
  isAnalyticsDataset,
  isAnalyticsTarget,
  type AnalyticsDataset,
  type AnalyticsTarget,
  type PipelineExport
} from '../domain/data-pipeline.js';

export type ExtractDataInput = {
  target: string | undefined;
  dataset: string | undefined;
};

export type CreateExportJobInput = {
  target: string | undefined;
  dataset: string | undefined;
  sinkType?: string | undefined;
  triggerType: ExportTriggerType;
};

export type ExtractDataResult =
  | { kind: 'ok'; exportResult: PipelineExport }
  | { kind: 'invalid'; errors: string[] };

export type CreateExportJobResult =
  | { kind: 'ok'; job: ExportJob; exportResult: PipelineExport }
  | { kind: 'invalid'; errors: string[] };

export type GetExportJobResult =
  | { kind: 'ok'; job: ExportJob }
  | { kind: 'not_found' };

export class DataPipelineApplication {
  constructor(
    private readonly sourceDataAdapter: SourceDataAdapter,
    private readonly exportFormatAdapter: ExportFormatAdapter,
    private readonly exportSinkAdapter: ExportSinkAdapter,
    private readonly exportJobStoreAdapter: ExportJobStoreAdapter,
    private readonly eventsAdapter: PipelineEventsAdapter
  ) {}

  async extractData(input: ExtractDataInput): Promise<ExtractDataResult> {
    const errors = validateExtractInput(input);
    if (errors.length > 0) {
      return { kind: 'invalid', errors };
    }

    const target = input.target as AnalyticsTarget;
    const dataset = input.dataset as AnalyticsDataset;

    const exportResult = await this.generateExport(target, dataset, 'bi-tool');

    await this.eventsAdapter.emitExportGenerated(exportResult);

    return {
      kind: 'ok',
      exportResult
    };
  }

  async createExportJob(input: CreateExportJobInput): Promise<CreateExportJobResult> {
    const errors = validateCreateExportJobInput(input);
    if (errors.length > 0) {
      return { kind: 'invalid', errors };
    }

    const target = input.target as AnalyticsTarget;
    const dataset = input.dataset as AnalyticsDataset;
    const sinkType = (input.sinkType ?? defaultSinkTypeForTarget(target)) as ExportSinkType;
    const triggerType = input.triggerType;
    const now = new Date().toISOString();
    const jobId = randomUUID();

    try {
      const exportResult = await this.generateExport(target, dataset, sinkType, jobId);
      const sinkReference = await this.exportSinkAdapter.writeExport(exportResult, sinkType);

      const job: ExportJob = {
        jobId,
        target,
        dataset,
        sinkType,
        triggerType,
        status: 'COMPLETED',
        rowCount: exportResult.rows.length,
        createdAt: now,
        completedAt: new Date().toISOString(),
        sinkReference,
        errorMessage: null
      };

      await this.exportJobStoreAdapter.saveJob(job);
      await this.eventsAdapter.emitExportGenerated(exportResult);

      return {
        kind: 'ok',
        job,
        exportResult
      };
    } catch (error: unknown) {
      const job: ExportJob = {
        jobId,
        target,
        dataset,
        sinkType,
        triggerType,
        status: 'FAILED',
        rowCount: 0,
        createdAt: now,
        completedAt: new Date().toISOString(),
        sinkReference: null,
        errorMessage: error instanceof Error ? error.message : 'unknown_error'
      };

      await this.exportJobStoreAdapter.saveJob(job);
      return {
        kind: 'ok',
        job,
        exportResult: {
          jobId,
          target,
          dataset,
          sinkType,
          generatedAt: job.completedAt,
          rows: []
        }
      };
    }
  }

  async runScheduledExport(input: Omit<CreateExportJobInput, 'triggerType'>): Promise<CreateExportJobResult> {
    return this.createExportJob({
      ...input,
      triggerType: 'SCHEDULED'
    });
  }

  async getExportJob(jobId: string): Promise<GetExportJobResult> {
    const job = await this.exportJobStoreAdapter.getJobById(jobId);
    if (!job) {
      return { kind: 'not_found' };
    }

    return { kind: 'ok', job };
  }

  private async generateExport(
    target: AnalyticsTarget,
    dataset: AnalyticsDataset,
    sinkType: ExportSinkType,
    jobId?: string
  ): Promise<PipelineExport> {
    const sourceRows = await this.sourceDataAdapter.fetchDataset(dataset);
    const rows = this.exportFormatAdapter.format(target, dataset, sourceRows);

    return {
      jobId: jobId ?? randomUUID(),
      target,
      dataset,
      sinkType,
      generatedAt: new Date().toISOString(),
      rows
    };
  }
}

function validateExtractInput(input: ExtractDataInput): string[] {
  const errors: string[] = [];

  if (!input.target || !isAnalyticsTarget(input.target)) {
    errors.push('target must be one of: bi, dashboard');
  }

  if (!input.dataset || !isAnalyticsDataset(input.dataset)) {
    errors.push('dataset must be one of: customers, accounts, loans, payments, profitability');
  }

  return errors;
}

function validateCreateExportJobInput(input: CreateExportJobInput): string[] {
  const errors = validateExtractInput(input);

  if (input.sinkType !== undefined && !isExportSinkType(input.sinkType)) {
    errors.push('sinkType must be one of: bi-tool, data-warehouse');
  }

  return errors;
}

function isExportSinkType(value: string): value is ExportSinkType {
  return value === 'bi-tool' || value === 'data-warehouse';
}

function defaultSinkTypeForTarget(target: AnalyticsTarget): ExportSinkType {
  return target === 'bi' ? 'bi-tool' : 'data-warehouse';
}
