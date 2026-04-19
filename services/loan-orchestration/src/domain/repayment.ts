export type RepaymentStatus = 'INITIATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type Repayment = {
  repaymentId: string;
  loanAccountId: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  status: RepaymentStatus;
  paymentId: string;
};

export type NewRepayment = {
  repaymentId: string;
  loanAccountId: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  paymentId: string;
};

export function buildRepayment(input: NewRepayment): Repayment {
  return {
    repaymentId: input.repaymentId,
    loanAccountId: input.loanAccountId,
    amountCents: input.amountCents,
    currency: input.currency,
    createdAt: input.createdAt,
    status: 'INITIATED',
    paymentId: input.paymentId
  };
}
