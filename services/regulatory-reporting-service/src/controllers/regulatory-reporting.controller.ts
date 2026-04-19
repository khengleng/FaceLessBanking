import { randomUUID } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { RegulatoryReportingApplication } from '../application/regulatory-reporting.application.js';

type GenerateRequest = FastifyRequest<{
  Body: {
    reportType?: unknown;
    businessDate?: unknown;
    dateRangeStart?: unknown;
    dateRangeEnd?: unknown;
    generatedBy?: unknown;
  };
}>;

type GetReportByIdRequest = FastifyRequest<{
  Params: {
    reportId: string;
  };
}>;

export function buildRegulatoryReportingController(application: RegulatoryReportingApplication) {
  async function getReports(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const reports = await application.listReports();

    reply.code(200).send({
      success: true,
      data: {
        items: reports
      }
    });
  }

  async function getReportById(request: GetReportByIdRequest, reply: FastifyReply): Promise<void> {
    const report = await application.getReportById(request.params.reportId);
    if (!report) {
      reply.code(404).send({
        success: false,
        error: 'report_not_found'
      });
      return;
    }

    reply.code(200).send({
      success: true,
      data: report
    });
  }

  async function postGenerate(request: GenerateRequest, reply: FastifyReply): Promise<void> {
    const idempotencyKey = resolveIdempotencyKey(request);
    const correlationId = resolveCorrelationId(request);

    const result = await application.generateReport({
      reportType: request.body?.reportType,
      businessDate: request.body?.businessDate,
      dateRangeStart: request.body?.dateRangeStart,
      dateRangeEnd: request.body?.dateRangeEnd,
      generatedBy: request.body?.generatedBy,
      idempotencyKey,
      correlationId
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
      data: result.report,
      correlationId
    });
  }

  return {
    getReports,
    getReportById,
    postGenerate
  };
}

function resolveIdempotencyKey(request: FastifyRequest): string | undefined {
  const direct = request.headers['idempotency-key'];
  const prefixed = request.headers['x-idempotency-key'];

  const value = Array.isArray(direct)
    ? direct[0]
    : Array.isArray(prefixed)
      ? prefixed[0]
      : direct ?? prefixed;

  return typeof value === 'string' ? value : undefined;
}

function resolveCorrelationId(request: FastifyRequest): string {
  const value = request.headers['x-correlation-id'];
  const normalized = Array.isArray(value) ? value[0] : value;

  if (typeof normalized === 'string' && normalized.trim().length > 0) {
    return normalized.trim();
  }

  return randomUUID();
}
