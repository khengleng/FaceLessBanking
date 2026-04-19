export type FXForwardStatus = 'OPEN' | 'SETTLED';

export interface FXForward {
  contractId: string;
  baseCurrency: string;
  quoteCurrency: string;
  notional: number;
  forwardRate: number;
  maturityDate: string;
  status: FXForwardStatus;
  createdAt: string;
}

export interface CreateFXForwardInput {
  baseCurrency: string;
  quoteCurrency: string;
  notional: number;
  forwardRate: number;
  maturityDate: string;
}

export function shouldSettleAtMaturity(contract: FXForward, nowIso: string): boolean {
  if (contract.status === 'SETTLED') {
    return false;
  }

  const maturity = Date.parse(contract.maturityDate);
  const now = Date.parse(nowIso);

  if (Number.isNaN(maturity) || Number.isNaN(now)) {
    return false;
  }

  return now >= maturity;
}
