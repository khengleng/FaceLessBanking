import { randomUUID } from 'node:crypto';

import type { ExportSinkType, PipelineExport } from '../domain/data-pipeline.js';

export class ExportSinkAdapter {
  async writeExport(_exportResult: PipelineExport, sinkType: ExportSinkType): Promise<string> {
    // Placeholder sink reference for BI/data warehouse ingestion.
    return `${sinkType}-export-${randomUUID()}`;
  }
}

