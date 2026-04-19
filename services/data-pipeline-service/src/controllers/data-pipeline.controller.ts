import type { FastifyReply, FastifyRequest } from 'fastify';

import type { DataPipelineApplication } from '../application/data-pipeline.application.js';

type ExportRequest = FastifyRequest<{
  Querystring: {
    target?: string;
    dataset?: string;
  };
}>;

type CreateExportJobRequest = FastifyRequest<{
  Body: {
    target?: string;
    dataset?: string;
    sinkType?: string;
  };
}>;

type GetExportJobRequest = FastifyRequest<{
  Params: {
    jobId: string;
  };
}>;

export function buildDataPipelineController(application: DataPipelineApplication) {
  async function getExport(request: ExportRequest, reply: FastifyReply): Promise<void> {
    const result = await application.extractData({
      target: request.query.target,
      dataset: request.query.dataset
    });

    if (result.kind === 'invalid') {
      reply.code(400).send({
        success: false,
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    reply.code(200).send({
      success: true,
      data: result.exportResult
    });
  }

  async function postExportJob(
    request: CreateExportJobRequest,
    reply: FastifyReply
  ): Promise<void> {
    const result = await application.createExportJob({
      target: request.body?.target,
      dataset: request.body?.dataset,
      sinkType: request.body?.sinkType,
      triggerType: 'MANUAL'
    });

    if (result.kind === 'invalid') {
      reply.code(400).send({
        success: false,
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    reply.code(201).send({
      success: true,
      data: {
        job: result.job,
        export: result.exportResult
      }
    });
  }

  async function postRunScheduledExport(
    request: CreateExportJobRequest,
    reply: FastifyReply
  ): Promise<void> {
    const result = await application.runScheduledExport({
      target: request.body?.target,
      dataset: request.body?.dataset,
      sinkType: request.body?.sinkType
    });

    if (result.kind === 'invalid') {
      reply.code(400).send({
        success: false,
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    reply.code(201).send({
      success: true,
      data: {
        job: result.job,
        export: result.exportResult
      }
    });
  }

  async function getExportJob(
    request: GetExportJobRequest,
    reply: FastifyReply
  ): Promise<void> {
    const result = await application.getExportJob(request.params.jobId);

    if (result.kind === 'not_found') {
      reply.code(404).send({
        success: false,
        error: 'export_job_not_found'
      });
      return;
    }

    reply.code(200).send({
      success: true,
      data: result.job
    });
  }

  return {
    getExport,
    postExportJob,
    postRunScheduledExport,
    getExportJob
  };
}
