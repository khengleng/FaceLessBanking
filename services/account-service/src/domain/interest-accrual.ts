export type DepositInterestAccrualStatus = 'DRAFT' | 'ACCURED' | 'FAILED';

export interface DepositInterestAccrual {
  accrualId: string;
  accountId: string;
  accrualDate: string; // ISO Date YYYY-MM-DD
  principalBasisCents: number;
  annualInterestRate: number; // e.g. 0.02 for 2%
  accruedInterestCents: number;
  createdAt: string;
  status: DepositInterestAccrualStatus;
}

/**
 * Calculates daily simple interest.
 * @param balanceCents Current principal
 * @param annualRate Annual percentage rate (e.g. 0.02)
 * @param daysInYear Standard year basis (e.g. 365)
 * @returns Interest in cents, rounded.
 */
export function calculateDailyInterestCents(
  balanceCents: number,
  annualRate: number,
  daysInYear: number = 365
): number {
  if (balanceCents <= 0) return 0;
  
  // (Principal * Rate) / Days
  const dailyInterest = (balanceCents * annualRate) / daysInYear;
  
  // Round to nearest integer (cent)
  return Math.round(dailyInterest);
}
