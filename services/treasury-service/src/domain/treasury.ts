export type TreasuryAccountCategory = 
  | 'RESERVE' 
  | 'NOSTRO' 
  | 'FEE_PROCEEDS' 
  | 'LOAN_FUNDING';

export interface TreasuryAccount {
  accountId: string;
  name: string;
  category: TreasuryAccountCategory;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface TreasuryTransfer {
  transferId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountCents: bigint;
  currency: string;
  purpose: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}
