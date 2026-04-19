import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { 
  buildErrorResponse, 
  buildSuccessResponse, 
  toCorrelationId 
} from '@faceless-banking/shared-types';
import type { ReconciliationApplication } from '../application/reconciliation.application.js';

const CreateJobSchema = z.object({
  jobType: z.enum(['PAYMENT_STATUS_RECON', 'BALANCE_SNAPSHOT_RECON', 'LOAN_STATUS_RECON'])
});

export function buildReconciliationController(reconciliationApp: ReconciliationApplication) {
  async function health(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ status: 'OK' });
  }

  async function createJob(request: FastifyRequest, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id']
      ? toCorrelationId(request.headers['x-correlation-id'] as string)
      : undefined;

    const validation = CreateJobSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send(buildErrorResponse({
        correlationId,
        error: { code: 'validation_error', message: 'Invalid job type', details: validation.error.issues.map((issue) => issue.message) }
      }));
    }

    const job = await reconciliationApp.createJob(validation.data.jobType);

    return reply.code(201).send(buildSuccessResponse({
      correlationId,
      data: job
    }));
  }

  async function getJob(request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id']
      ? toCorrelationId(request.headers['x-correlation-id'] as string)
      : undefined;

    const details = await reconciliationApp.getJobDetails(request.params.jobId);
    if (!details) {
      return reply.code(404).send(buildErrorResponse({
        correlationId,
        error: { code: 'not_found', message: 'Reconciliation job not found' }
      }));
    }

    return reply.send(buildSuccessResponse({
      correlationId,
      data: details
    }));
  }

  async function runJob(request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) {
    const correlationId = request.headers['x-correlation-id']
      ? toCorrelationId(request.headers['x-correlation-id'] as string)
      : undefined;

    try {
      await reconciliationApp.runJob(request.params.jobId, correlationId);
      return reply.code(202).send(buildSuccessResponse({
        correlationId,
        data: { status: 'ACCEPTED' }
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'reconciliation_run_failed';
      return reply.code(400).send(buildErrorResponse({
        correlationId,
        error: { code: 'bad_request', message }
      }));
    }
  }

  return { health, createJob, getJob, runJob };
}
