export interface PaymentOrchestrationAdapter {
  initiateInternalTransfer(params: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ paymentId: string }>;
}

export class PaymentOrchestrationAdapterStub implements PaymentOrchestrationAdapter {
  async initiateInternalTransfer(params: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ paymentId: string }> {
    console.log('Initiating fee collection payment', params);
    return { paymentId: `pay_fee_${params.idempotencyKey}` };
  }
}
