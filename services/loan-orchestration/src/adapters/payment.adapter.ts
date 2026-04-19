import { randomUUID } from 'node:crypto';

export type InitiateInternalTransferInput = {
  sourceAccountId: string;
  destinationAccountId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  correlationId: string;
  channel: 'loan-disbursement' | 'loan-repayment';
};

export type InitiateInternalTransferResult = {
  paymentId: string;
  status: 'ACCEPTED' | 'PENDING';
};

export interface PaymentAdapter {
  initiateTransfer(
    input: InitiateInternalTransferInput
  ): Promise<InitiateInternalTransferResult>;
}

export class PaymentAdapterStub implements PaymentAdapter {
  public readonly requests: InitiateInternalTransferInput[] = [];

  async initiateTransfer(
    input: InitiateInternalTransferInput
  ): Promise<InitiateInternalTransferResult> {
    this.requests.push(input);
    return {
      paymentId: `payment-${randomUUID()}`,
      status: 'ACCEPTED'
    };
  }
}
