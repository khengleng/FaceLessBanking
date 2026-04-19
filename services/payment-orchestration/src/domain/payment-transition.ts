import type { PaymentStatus } from './payment.js';

export const PAYMENT_PROCESSOR_STAGE = 'payment-processor.v1';

const ALLOWED_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  ACCEPTED: ['PROCESSING'],
  PENDING: ['PROCESSING'],
  PROCESSING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
  REJECTED: []
};

export function canTransitionPaymentStatus(from: PaymentStatus, to: PaymentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isProcessorStartState(status: PaymentStatus): boolean {
  return status === 'ACCEPTED' || status === 'PENDING';
}
