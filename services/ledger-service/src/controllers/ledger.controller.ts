import type { FastifyReply, FastifyRequest } from 'fastify';

import type { LedgerApplication } from '../application/ledger.application.js';
import type { CreateAnchorRequestDto } from './dtos/ledger.dto.js';
import {
  toLedgerAnchorResponseDto,
  toLedgerProofResponseDto
} from './dtos/ledger.dto.js';

type CreateAnchorRequest = FastifyRequest<{ Body: CreateAnchorRequestDto }>;
type GetAnchorRequest = FastifyRequest<{ Params: { anchorId: string } }>;
type GetProofRequest = FastifyRequest<{ Params: { eventId: string } }>;

export function buildLedgerController(ledgerApplication: LedgerApplication) {
  async function createAnchor(request: CreateAnchorRequest, reply: FastifyReply): Promise<void> {
    const result = await ledgerApplication.createAnchor(request.body);

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    reply.code(201).send(toLedgerAnchorResponseDto(result.anchor));
  }

  async function getAnchorById(request: GetAnchorRequest, reply: FastifyReply): Promise<void> {
    const result = await ledgerApplication.getAnchorById(request.params.anchorId);

    if (result.kind === 'not_found') {
      reply.code(404).send({ error: 'ledger_anchor_not_found' });
      return;
    }

    reply.code(200).send(toLedgerAnchorResponseDto(result.anchor));
  }

  async function getProofByEventId(request: GetProofRequest, reply: FastifyReply): Promise<void> {
    const result = await ledgerApplication.getProofByEventId(request.params.eventId);

    if (result.kind === 'not_found') {
      reply.code(404).send({ error: 'ledger_proof_not_found' });
      return;
    }

    reply.code(200).send(toLedgerProofResponseDto(result.proof));
  }

  return {
    createAnchor,
    getAnchorById,
    getProofByEventId
  };
}
