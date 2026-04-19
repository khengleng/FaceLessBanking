import { z } from 'zod';

import type { Beneficiary } from '../../domain/beneficiary.js';
import type { Payment, PaymentStatus } from '../../domain/payment.js';

export const InternalTransferSchema = z.object({
  sourceAccountId: z.string().min(3, 'sourceAccountId must contain at least 3 characters'),
  destinationAccountId: z.string().min(3, 'destinationAccountId must contain at least 3 characters'),
  amount: z.number().positive('amount must be greater than 0'),
  currency: z.string().length(3, 'currency must be a 3-letter currency code'),
  channel: z.string().min(2, 'channel must contain at least 2 characters').default('internal')
}).refine((value) => value.sourceAccountId !== value.destinationAccountId, {
  message: 'sourceAccountId and destinationAccountId must be different',
  path: ['destinationAccountId']
});

export type InternalTransferRequestDto = z.infer<typeof InternalTransferSchema>;

export type CreateBeneficiaryRequestDto = {
  customerId: string;
  name: string;
  accountId: string;
  bankCode: string;
};

export type PaymentResponseDto = {
  paymentId: string;
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

export type BeneficiaryResponseDto = {
  beneficiaryId: string;
  customerId: string;
  name: string;
  accountId: string;
  bankCode: string;
  status: string;
  createdAt: string;
};

export type ListPaymentsQueryDto = {
  status?: PaymentStatus;
  accountId?: string;
  correlationId?: string;
  limit?: number;
  offset?: number;
};

export function toPaymentResponseDto(payment: Payment): PaymentResponseDto {
  return {
    paymentId: payment.paymentId,
    sourceAccountId: payment.sourceAccountId,
    destinationAccountId: payment.destinationAccountId,
    amount: payment.amount,
    currency: payment.currency,
    channel: payment.channel,
    status: payment.status,
    correlationId: payment.correlationId,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  };
}

export function toBeneficiaryResponseDto(beneficiary: Beneficiary): BeneficiaryResponseDto {
  return {
    beneficiaryId: beneficiary.beneficiaryId,
    customerId: beneficiary.customerId,
    name: beneficiary.name,
    accountId: beneficiary.accountId,
    bankCode: beneficiary.bankCode,
    status: beneficiary.status,
    createdAt: beneficiary.createdAt
  };
}
