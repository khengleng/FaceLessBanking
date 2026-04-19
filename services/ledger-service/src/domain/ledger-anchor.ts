export type LedgerAnchorStatus = 'requested';

export type LedgerAnchor = {
  anchorId: string;
  eventId: string;
  hash: string;
  chain: string;
  status: LedgerAnchorStatus;
  transactionId: string;
  createdAt: string;
};

export type NewLedgerAnchor = {
  anchorId: string;
  eventId: string;
  hash: string;
  chain: string;
  transactionId: string;
  createdAt: string;
};

export function buildLedgerAnchor(input: NewLedgerAnchor): LedgerAnchor {
  return {
    anchorId: input.anchorId,
    eventId: input.eventId,
    hash: input.hash,
    chain: input.chain,
    status: 'requested',
    transactionId: input.transactionId,
    createdAt: input.createdAt
  };
}
