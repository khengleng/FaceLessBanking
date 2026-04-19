export type TreasuryAccountType = 'SETTLEMENT' | 'FUNDING' | 'BUFFER';

export interface TreasuryAccount {
  accountId: string;
  currency: string;
  balanceCents: bigint;
  type: TreasuryAccountType;
}

export interface TreasuryTransfer {
  transferId: string;
  fromAccount: string;
  toAccount: string;
  amountCents: bigint;
  currency: string;
  status: 'INITIATED' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}
