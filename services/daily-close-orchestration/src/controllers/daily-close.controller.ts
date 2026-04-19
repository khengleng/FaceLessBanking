import type { FastifyReply, FastifyRequest } from 'fastify';
import { 
  buildErrorResponse, 
  buildSuccessResponse, 
  toCorrelationId 
} from '@faceless-banking/shared-types';
import type { DailyCloseApplication } from '../application/daily-close.application.js';
import { z } from 'zod';

const RunDailyCloseSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
});

export function buildDailyCloseController(dailyCloseApp: DailyCloseApplication) {
  async function health(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ status: 'OK' });
  }

  async function startRun(request: FastifyRequest, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id'] 
      ? toCorrelationId(request.headers['x-correlation-id'] as string) 
      : undefined;

    const validation = RunDailyCloseSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send(buildErrorResponse({
        correlationId,
        error: { code: 'validation_error', message: 'Invalid data', details: validation.error.errors.map(e => e.message) }
      }));
    }

    const result = await dailyCloseApp.runDailyClose(validation.data.businessDate, correlationId);

    if (result.kind === 'already_running' || result.kind === 'already_completed') {
      return reply.code(409).send(buildErrorResponse({
        correlationId,
        error: { code: 'conflict', message: `Batch ${result.kind}` }
      }));
    }

    if (result.kind === 'error') {
      return reply.code(400).send(buildErrorResponse({
        correlationId,
        error: { code: 'bad_request', message: result.reason || 'Failed to start run' }
      }));
    }

    return reply.code(202).send(buildSuccessResponse({
      correlationId,
      data: { runId: result.runId, status: 'STARTED' }
    }));
  }

  async function getRun(request: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id'] 
      ? toCorrelationId(request.headers['x-correlation-id'] as string) 
      : undefined;

    const details = await dailyCloseApp.getRunDetails(request.params.runId);

    if (!details) {
      return reply.code(404).send(buildErrorResponse({
        correlationId,
        error: { code: 'not_found', message: 'Batch run not found' }
      }));
    }

    return reply.send(buildSuccessResponse({
      correlationId,
      data: details
    }));
  }

  return { health, startRun, getRun };
}
