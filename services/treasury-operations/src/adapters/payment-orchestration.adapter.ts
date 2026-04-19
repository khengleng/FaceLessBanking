export interface PaymentOrchestrationAdapter {
  initiateInternalTransfer(params: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountCents: bigint;
    currency: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ paymentId: string }>;
}

export class PaymentOrchestrationAdapterStub implements PaymentOrchestrationAdapter {
  async initiateInternalTransfer(params: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountCents: bigint;
    currency: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ paymentId: string }> {
    console.log('Orchestrating treasury transfer', params);
    return { paymentId: `pay_ops_${Date.now()}` };
  }
}
