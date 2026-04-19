export type LoanStatus =
  | 'CREATED'
  | 'DISBURSEMENT_PENDING'
  | 'DISBURSED'
  | 'ACTIVE'
  | 'DELINQUENT'
  | 'CLOSED';

export type Loan = {
  loanId: string;
  customerId: string;
  productCode: string;
  principalCents: number;
  annualInterestRateBps?: number;
  currency: string;
  termMonths: number;
  status: LoanStatus;
  createdAt: string;
  externalLoanId: string;
};

export type NewLoan = {
  loanId: string;
  customerId: string;
  productCode: string;
  principalCents: number;
  annualInterestRateBps?: number;
  currency: string;
  termMonths: number;
  createdAt: string;
  externalLoanId: string;
};

export function buildLoan(input: NewLoan): Loan {
  return {
    loanId: input.loanId,
    customerId: input.customerId,
    productCode: input.productCode,
    principalCents: input.principalCents,
    annualInterestRateBps: input.annualInterestRateBps,
    currency: input.currency,
    termMonths: input.termMonths,
    status: 'CREATED',
    createdAt: input.createdAt,
    externalLoanId: input.externalLoanId
  };
}

export function canTransitionLoanStatus(from: LoanStatus, to: LoanStatus): boolean {
  if (from === to) {
    return true;
  }

  if (from === 'CREATED' && to === 'DISBURSEMENT_PENDING') {
    return true;
  }

  if (from === 'DISBURSEMENT_PENDING' && to === 'DISBURSED') {
    return true;
  }

  if (from === 'DISBURSED' && to === 'ACTIVE') {
    return true;
  }

  if (from === 'ACTIVE' && to === 'DELINQUENT') {
    return true;
  }

  if (from === 'DELINQUENT' && to === 'ACTIVE') {
    return true;
  }

  if ((from === 'ACTIVE' || from === 'DELINQUENT') && to === 'CLOSED') {
    return true;
  }

  return false;
}
