import type { FastifyReply, FastifyRequest } from 'fastify';
import { 
  buildErrorResponse, 
  buildNotFoundError, 
  buildSuccessResponse, 
  buildValidationError,
  toCorrelationId
} from '@faceless-banking/shared-types';
import type { AccountingApplication } from '../application/accounting.application.js';
import { CreateManualJournalSchema, type CreateManualJournalRequestDto } from './dtos/accounting.dto.js';

export function buildAccountingController(accountingApplication: AccountingApplication) {
  async function health(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ status: 'OK' });
  }

  async function createManualJournal(
    request: FastifyRequest<{ Body: CreateManualJournalRequestDto }>,
    reply: FastifyReply
  ) {
    const correlationId = request.headers['x-correlation-id'] 
      ? toCorrelationId(request.headers['x-correlation-id'] as string) 
      : undefined;

    const validation = CreateManualJournalSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({ details: validation.error.errors.map(e => e.message) })
      }));
    }

    const result = await accountingApplication.createManualJournal(request.body);

    if (result.kind === 'unbalanced') {
      return reply.code(400).send(buildErrorResponse({
        correlationId,
        error: { code: 'unbalanced_journal', message: 'Debits and credits must balance', retriable: false }
      }));
    }

    if (result.kind === 'created') {
      return reply.code(201).send(buildSuccessResponse({
        correlationId,
        data: {
          ...result.journal.entry,
          lines: result.journal.lines
        }
      }));
    }

    return reply.code(500).send(buildErrorResponse({
      correlationId,
      error: { code: 'internal_error', message: 'Failed to create journal', retriable: true }
    }));
  }

  async function getJournalById(
    request: FastifyRequest<{ Params: { journalId: string } }>,
    reply: FastifyReply
  ) {
    const correlationId = request.headers['x-correlation-id'] 
      ? toCorrelationId(request.headers['x-correlation-id'] as string) 
      : undefined;

    const journal = await accountingApplication.getJournalById(request.params.journalId);

    if (!journal) {
      return reply.code(404).send(buildErrorResponse({
        correlationId,
        error: buildNotFoundError('Journal not found')
      }));
    }

    return reply.send(buildSuccessResponse({
      correlationId,
      data: {
        ...journal.entry,
        lines: journal.lines
      }
    }));
  }

  return { health, createManualJournal, getJournalById };
}
