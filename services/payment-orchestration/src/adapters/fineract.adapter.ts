export type FineractInternalTransferRequest = {
  sourceAccountId: string;
  destinationAccountId: string;
  amountCents: number;
  currency: string;
  reference: string;
};

export type FineractInternalTransferResult = {
  externalTransferId: string;
};

export interface FineractAdapter {
  initiateInternalTransfer(
    request: FineractInternalTransferRequest
  ): Promise<FineractInternalTransferResult>;
}

export class FineractAdapterStub implements FineractAdapter {
  async initiateInternalTransfer(
    request: FineractInternalTransferRequest
  ): Promise<FineractInternalTransferResult> {
    return {
      externalTransferId: `fineract-transfer-${request.sourceAccountId}-${request.destinationAccountId}`
    };
  }
}
