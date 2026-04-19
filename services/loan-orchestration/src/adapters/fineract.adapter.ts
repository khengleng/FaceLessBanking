export type FineractCreateLoanRequest = {
  customerId: string;
  productCode: string;
  principalCents: number;
  currency: string;
  termMonths: number;
};

export type FineractCreateLoanResult = {
  externalLoanId: string;
};

export type FineractInitiateRepaymentRequest = {
  loanId: string;
  amountCents: number;
  currency: string;
};

export type FineractInitiateRepaymentResult = {
  externalRepaymentId: string;
};

export interface FineractAdapter {
  createLoan(request: FineractCreateLoanRequest): Promise<FineractCreateLoanResult>;
  initiateRepayment(request: FineractInitiateRepaymentRequest): Promise<FineractInitiateRepaymentResult>;
}

export class FineractAdapterStub implements FineractAdapter {
  async createLoan(request: FineractCreateLoanRequest): Promise<FineractCreateLoanResult> {
    return {
      externalLoanId: `fineract-loan-${request.customerId}-${request.productCode}`
    };
  }

  async initiateRepayment(
    request: FineractInitiateRepaymentRequest
  ): Promise<FineractInitiateRepaymentResult> {
    return {
      externalRepaymentId: `fineract-repayment-${request.loanId}-${request.amountCents}`
    };
  }
}
