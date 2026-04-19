export type LedgerProof = {
  eventId: string;
  anchorId: string;
  hash: string;
  chain: string;
  transactionId: string;
  proofStatus: 'available';
  generatedAt: string;
};

export type NewLedgerProof = {
  eventId: string;
  anchorId: string;
  hash: string;
  chain: string;
  transactionId: string;
  generatedAt: string;
};

export function buildLedgerProof(input: NewLedgerProof): LedgerProof {
  return {
    eventId: input.eventId,
    anchorId: input.anchorId,
    hash: input.hash,
    chain: input.chain,
    transactionId: input.transactionId,
    proofStatus: 'available',
    generatedAt: input.generatedAt
  };
}
