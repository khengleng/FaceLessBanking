import type { Loan } from '../../domain/loan.js';
import type { Repayment } from '../../domain/repayment.js';

export type CreateLoanRequestDto = {
  customerId: string;
  productCode: string;
  principalCents: number;
  currency: string;
  termMonths: number;
};

export type CreateRepaymentRequestDto = {
  amountCents: number;
  currency: string;
  sourceAccountId: string;
};

export type LoanResponseDto = {
  loanId: string;
  customerId: string;
  productCode: string;
  principalCents: number;
  currency: string;
  termMonths: number;
  status: string;
  createdAt: string;
  externalLoanId: string;
};

export type RepaymentResponseDto = {
  repaymentId: string;
  loanAccountId: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  paymentId: string;
};

export function toLoanResponseDto(loan: Loan): LoanResponseDto {
  return {
    loanId: loan.loanId,
    customerId: loan.customerId,
    productCode: loan.productCode,
    principalCents: loan.principalCents,
    currency: loan.currency,
    termMonths: loan.termMonths,
    status: loan.status,
    createdAt: loan.createdAt,
    externalLoanId: loan.externalLoanId
  };
}

export function toRepaymentResponseDto(repayment: Repayment): RepaymentResponseDto {
  return {
    repaymentId: repayment.repaymentId,
    loanAccountId: repayment.loanAccountId,
    amountCents: repayment.amountCents,
    currency: repayment.currency,
    status: repayment.status,
    createdAt: repayment.createdAt,
    paymentId: repayment.paymentId
  };
}
