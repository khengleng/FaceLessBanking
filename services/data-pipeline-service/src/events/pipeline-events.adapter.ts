import type { PipelineExport } from '../domain/data-pipeline.js';

export class PipelineEventsAdapter {
  async emitExportGenerated(exportResult: PipelineExport): Promise<void> {
    void exportResult;
    // Placeholder for future pipeline.export.generated.v1 emission.
  }
}
