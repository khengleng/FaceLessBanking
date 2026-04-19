export interface VirtualAccount {
  virtualAccountId: string;
  corporateId: string;
  accountNumber: string;
  mappedAccountId: string;
  currency: string;
  createdAt: string;
}

export interface CreateVirtualAccountInput {
  corporateId: string;
  mappedAccountId: string;
  currency: string;
}

export type BulkPaymentStatus = 'ACCEPTED' | 'PROCESSED';

export interface BulkPaymentItem {
  paymentItemId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
  status: BulkPaymentStatus;
}

export interface BulkPaymentBatch {
  batchId: string;
  corporateId: string;
  items: BulkPaymentItem[];
  totalAmount: number;
  currency: string;
  status: BulkPaymentStatus;
  createdAt: string;
}

export interface CreateBulkPaymentInput {
  corporateId: string;
  currency: string;
  items: Array<{
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
  }>;
}

export interface CorporateCashPosition {
  corporateId: string;
  currency: string;
  virtualAccountCount: number;
  totalProcessedBulkAmount: number;
  updatedAt: string;
}
