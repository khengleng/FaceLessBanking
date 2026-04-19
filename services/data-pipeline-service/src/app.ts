import Fastify, { type FastifyInstance } from 'fastify';

import { ExportFormatAdapter } from './adapters/export-format.adapter.js';
import { ExportJobStoreAdapter } from './adapters/export-job-store.adapter.js';
import { ExportSinkAdapter } from './adapters/export-sink.adapter.js';
import { SourceDataAdapter } from './adapters/source-data.adapter.js';
import { DataPipelineApplication } from './application/data-pipeline.application.js';
import { buildDataPipelineController } from './controllers/data-pipeline.controller.js';
import { PipelineEventsAdapter } from './events/pipeline-events.adapter.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const sourceDataAdapter = new SourceDataAdapter();
  const exportFormatAdapter = new ExportFormatAdapter();
  const exportSinkAdapter = new ExportSinkAdapter();
  const exportJobStoreAdapter = new ExportJobStoreAdapter();
  const eventsAdapter = new PipelineEventsAdapter();
  const application = new DataPipelineApplication(
    sourceDataAdapter,
    exportFormatAdapter,
    exportSinkAdapter,
    exportJobStoreAdapter,
    eventsAdapter
  );
  const controller = buildDataPipelineController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  app.get('/pipeline/export', controller.getExport);
  app.post('/pipeline/export-jobs', controller.postExportJob);
  app.get('/pipeline/export-jobs/:jobId', controller.getExportJob);
  app.post('/pipeline/scheduled-export/run', controller.postRunScheduledExport);

  return app;
}
