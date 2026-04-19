import type { Account } from '../../domain/account.js';

export type CreateAccountRequestDto = {
  customerId: string;
  productCode: string;
  currency: string;
  initialDepositCents?: number;
};

export type AccountResponseDto = {
  accountId: string;
  customerId: string;
  productCode: string;
  currency: string;
  status: string;
  createdAt: string;
  externalAccountId: string;
};

export type AccountBalanceResponseDto = {
  accountId: string;
  availableBalanceCents: number;
  ledgerBalanceCents: number;
  currency: string;
};

export type ListAccountsQueryDto = {
  customerId?: string;
  accountId?: string;
  onboardingReference?: string;
  limit?: number;
  offset?: number;
};

export type ActivateAccountRequestDto = {
  reason?: string;
};

export function toAccountResponseDto(account: Account): AccountResponseDto {
  return {
    accountId: account.accountId,
    customerId: account.customerId,
    productCode: account.productCode,
    currency: account.currency,
    status: account.status,
    createdAt: account.createdAt,
    externalAccountId: account.externalAccountId
  };
}

export function toAccountBalanceResponseDto(account: Account): AccountBalanceResponseDto {
  return {
    accountId: account.accountId,
    availableBalanceCents: account.availableBalanceCents,
    ledgerBalanceCents: account.ledgerBalanceCents,
    currency: account.currency
  };
}
