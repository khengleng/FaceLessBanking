export type LiquidityPosition = {
  currency: string;
  availableCash: bigint;
  reservedCash: bigint;
  outgoingPending: bigint;
  incomingPending: bigint;
  updatedAt: string;
};

export function buildInitialPosition(currency: string): LiquidityPosition {
  return {
    currency,
    availableCash: 0n,
    reservedCash: 0n,
    outgoingPending: 0n,
    incomingPending: 0n,
    updatedAt: new Date().toISOString()
  };
}
