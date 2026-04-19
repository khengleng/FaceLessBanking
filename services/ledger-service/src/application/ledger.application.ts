import { randomUUID } from 'node:crypto';

import type { BlockchainAdapter } from '../adapters/blockchain.adapter.js';
import type { PostgresLedgerAdapter } from '../adapters/postgres-ledger.adapter.js';
import type { CreateAnchorRequestDto } from '../controllers/dtos/ledger.dto.js';
import { buildLedgerAnchor, type LedgerAnchor } from '../domain/ledger-anchor.js';
import { buildLedgerProof, type LedgerProof } from '../domain/ledger-proof.js';
import type { LedgerEventsPublisher } from '../events/ledger.events.js';

export type CreateAnchorResult =
  | { kind: 'created'; anchor: LedgerAnchor }
  | { kind: 'invalid_payload'; errors: string[] };

export type GetAnchorResult =
  | { kind: 'found'; anchor: LedgerAnchor }
  | { kind: 'not_found' };

export type GetProofResult =
  | { kind: 'found'; proof: LedgerProof }
  | { kind: 'not_found' };

export class LedgerApplication {
  constructor(
    private readonly postgresAdapter: PostgresLedgerAdapter,
    private readonly blockchainAdapter: BlockchainAdapter,
    private readonly ledgerEvents: LedgerEventsPublisher
  ) {}

  async createAnchor(payload: CreateAnchorRequestDto): Promise<CreateAnchorResult> {
    const errors = validateCreateAnchorPayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const blockchain = await this.blockchainAdapter.submitAnchor({
      hash: payload.hash,
      chain: payload.chain
    });

    const anchor = buildLedgerAnchor({
      anchorId: randomUUID(),
      eventId: payload.eventId,
      hash: payload.hash,
      chain: payload.chain,
      transactionId: blockchain.transactionId,
      createdAt: new Date().toISOString()
    });

    await this.postgresAdapter.insertAnchor(anchor);
    await this.ledgerEvents.emitAnchorRequested(anchor);

    return { kind: 'created', anchor };
  }

  async getAnchorById(anchorId: string): Promise<GetAnchorResult> {
    const anchor = await this.postgresAdapter.findAnchorById(anchorId);

    if (!anchor) {
      return { kind: 'not_found' };
    }

    return { kind: 'found', anchor };
  }

  async getProofByEventId(eventId: string): Promise<GetProofResult> {
    const anchor = await this.postgresAdapter.findAnchorByEventId(eventId);

    if (!anchor) {
      return { kind: 'not_found' };
    }

    const proof = buildLedgerProof({
      eventId: anchor.eventId,
      anchorId: anchor.anchorId,
      hash: anchor.hash,
      chain: anchor.chain,
      transactionId: anchor.transactionId,
      generatedAt: new Date().toISOString()
    });

    return { kind: 'found', proof };
  }
}

function validateCreateAnchorPayload(payload: CreateAnchorRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.eventId || payload.eventId.trim().length < 3) {
    errors.push('eventId must contain at least 3 characters');
  }

  if (!payload.hash || payload.hash.trim().length < 10) {
    errors.push('hash must contain at least 10 characters');
  }

  if (!payload.chain || payload.chain.trim().length < 2) {
    errors.push('chain must contain at least 2 characters');
  }

  return errors;
}
