export type FineractCreateAccountRequest = {
  customerId: string;
  productCode: string;
  currency: string;
  initialDepositCents: number;
};

export type FineractCreateAccountResult = {
  externalAccountId: string;
  openingBalanceCents: number;
};

export interface FineractAdapter {
  createAccount(request: FineractCreateAccountRequest): Promise<FineractCreateAccountResult>;
}

export class FineractAdapterStub implements FineractAdapter {
  async createAccount(request: FineractCreateAccountRequest): Promise<FineractCreateAccountResult> {
    return {
      externalAccountId: `fineract-${request.customerId}-${request.productCode}`,
      openingBalanceCents: request.initialDepositCents
    };
  }
}
