export type BalanceProjectionEvent = {
  eventId: string;
  accountId: string;
  deltaAmount: number;
  resultingAvailableBalance?: number;
  resultingLedgerBalance?: number;
  currency: string;
  timestamp: string;
  correlationId: string;
};
