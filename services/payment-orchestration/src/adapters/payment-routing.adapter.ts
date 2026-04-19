export type RoutingRequest = {
  sourceAccountId: string;
  destinationAccountId: string;
  amountCents: number;
  currency: string;
};

export type RoutingResult = {
  approved: true;
};

export interface PaymentRoutingAdapter {
  verifyInternalTransferRoute(request: RoutingRequest): Promise<RoutingResult>;
}

export class PaymentRoutingAdapterStub implements PaymentRoutingAdapter {
  async verifyInternalTransferRoute(request: RoutingRequest): Promise<RoutingResult> {
    void request;
    return { approved: true };
  }
}
