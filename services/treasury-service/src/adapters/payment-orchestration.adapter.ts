export interface PaymentOrchestrationAdapter {
  initiateTransfer(params: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountCents: bigint;
    currency: string;
    idempotencyKey: string;
    purpose: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ paymentId: string }>;
}

export class PaymentOrchestrationAdapterStub implements PaymentOrchestrationAdapter {
  async initiateTransfer(params: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountCents: bigint;
    currency: string;
    idempotencyKey: string;
    purpose: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ paymentId: string }> {
    console.log('Initiating treasury rebalance payment', params);
    return { paymentId: `pay_treasury_${Date.now()}` };
  }
}
