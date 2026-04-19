import { randomUUID } from 'node:crypto';

export type AccrualMode = 'DAILY' | 'MONTHLY';

export type LoanInterestAccrual = {
  accrualId: string;
  loanAccountId: string;
  accrualMode: AccrualMode;
  accrualDate: string;
  principalBasis: number;
  accruedInterest: number;
  annualInterestRate: number;
  createdAt: string;
};

export function calculateSimpleInterestAccrual(input: {
  loanAccountId: string;
  accrualMode: AccrualMode;
  accrualDate: string;
  principalBasis: number;
  annualInterestRateBps: number;
  createdAt: string;
  dayCountBasis?: number;
}): LoanInterestAccrual {
  const annualRateDecimal = input.annualInterestRateBps / 10_000;
  const dayCountBasis = input.dayCountBasis ?? 365;

  // Placeholder formulas:
  // DAILY: principal * annual_rate / day_count_basis
  // MONTHLY: principal * annual_rate / 12
  const rawAccruedInterest = input.accrualMode === 'DAILY'
    ? input.principalBasis * annualRateDecimal / dayCountBasis
    : input.principalBasis * annualRateDecimal / 12;

  return {
    accrualId: randomUUID(),
    loanAccountId: input.loanAccountId,
    accrualMode: input.accrualMode,
    accrualDate: input.accrualDate,
    principalBasis: input.principalBasis,
    accruedInterest: Math.round(rawAccruedInterest),
    annualInterestRate: annualRateDecimal,
    createdAt: input.createdAt
  };
}
