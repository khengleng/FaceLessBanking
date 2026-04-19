export const PAYMENT_STATUSES = [
  'ACCEPTED',
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REJECTED'
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type Payment = {
  paymentId: string;
  idempotencyKey: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
  channel: string;
  status: PaymentStatus;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
};

export type NewPayment = {
  paymentId: string;
  idempotencyKey: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
  channel: string;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
  status?: PaymentStatus;
};

export function buildPayment(input: NewPayment): Payment {
  return {
    paymentId: input.paymentId,
    idempotencyKey: input.idempotencyKey,
    sourceAccountId: input.sourceAccountId,
    destinationAccountId: input.destinationAccountId,
    amount: input.amount,
    currency: input.currency,
    channel: input.channel,
    status: input.status ?? 'ACCEPTED',
    correlationId: input.correlationId,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return PAYMENT_STATUSES.includes(value as PaymentStatus);
}
