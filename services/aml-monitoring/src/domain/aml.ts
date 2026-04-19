export type AlertStatus = 'OPEN' | 'REVIEWED' | 'DISMISSED';

export interface AMLAlert {
  alertId: string;
  accountId: string;
  transactionId: string;
  reason: string;
  amount: number;
  status: AlertStatus;
  createdAt: string;
}

export interface TransactionSignal {
  eventId: string;
  correlationId: string;
  transactionId: string;
  accountId: string;
  amount: number;
  currency: string;
  timestamp: string;
}

export const LARGE_TRANSACTION_THRESHOLD = 10_000;

export function isLargeTransaction(amount: number): boolean {
  return amount >= LARGE_TRANSACTION_THRESHOLD;
}

export function isUnusualPattern(currentAmount: number, historicalAverage: number): boolean {
  if (historicalAverage <= 0) {
    return false;
  }

  return currentAmount >= historicalAverage * 3;
}
