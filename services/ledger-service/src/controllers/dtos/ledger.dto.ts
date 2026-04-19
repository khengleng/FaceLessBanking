import type { LedgerAnchor } from '../../domain/ledger-anchor.js';
import type { LedgerProof } from '../../domain/ledger-proof.js';

export type CreateAnchorRequestDto = {
  eventId: string;
  hash: string;
  chain: string;
};

export type LedgerAnchorResponseDto = {
  anchorId: string;
  eventId: string;
  hash: string;
  chain: string;
  status: string;
  transactionId: string;
  createdAt: string;
};

export type LedgerProofResponseDto = {
  eventId: string;
  anchorId: string;
  hash: string;
  chain: string;
  transactionId: string;
  proofStatus: string;
  generatedAt: string;
};

export function toLedgerAnchorResponseDto(anchor: LedgerAnchor): LedgerAnchorResponseDto {
  return {
    anchorId: anchor.anchorId,
    eventId: anchor.eventId,
    hash: anchor.hash,
    chain: anchor.chain,
    status: anchor.status,
    transactionId: anchor.transactionId,
    createdAt: anchor.createdAt
  };
}

export function toLedgerProofResponseDto(proof: LedgerProof): LedgerProofResponseDto {
  return {
    eventId: proof.eventId,
    anchorId: proof.anchorId,
    hash: proof.hash,
    chain: proof.chain,
    transactionId: proof.transactionId,
    proofStatus: proof.proofStatus,
    generatedAt: proof.generatedAt
  };
}
