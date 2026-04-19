export type BalanceSnapshot = {
  accountId: string;
  availableBalance: number;
  ledgerBalance: number;
  currency: string;
  version: number;
  updatedAt: string;
  sourceEventId?: string;
};

export function buildInitialBalanceSnapshot(input: {
  accountId: string;
  currency: string;
  updatedAt: string;
  sourceEventId?: string;
}): BalanceSnapshot {
  return {
    accountId: input.accountId,
    availableBalance: 0,
    ledgerBalance: 0,
    currency: input.currency,
    version: 1,
    updatedAt: input.updatedAt,
    sourceEventId: input.sourceEventId
  };
}
