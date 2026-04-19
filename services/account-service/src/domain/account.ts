export const ACCOUNT_STATUSES = [
  'PENDING_ACTIVATION',
  'ACTIVE',
  'SUSPENDED',
  'CLOSED'
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export type Account = {
  accountId: string;
  customerId: string;
  onboardingReference?: string;
  sourceEventId?: string;
  accountType?: string;
  productCode: string;
  currency: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt?: string;
  externalAccountId: string;
  availableBalanceCents: number;
  ledgerBalanceCents: number;
};

export type NewAccount = {
  accountId: string;
  customerId: string;
  onboardingReference?: string;
  sourceEventId?: string;
  accountType?: string;
  productCode: string;
  currency: string;
  createdAt: string;
  updatedAt?: string;
  status?: AccountStatus;
  externalAccountId: string;
  openingBalanceCents: number;
};

export function buildAccount(input: NewAccount): Account {
  return {
    accountId: input.accountId,
    customerId: input.customerId,
    onboardingReference: input.onboardingReference,
    sourceEventId: input.sourceEventId,
    accountType: input.accountType,
    productCode: input.productCode,
    currency: input.currency,
    status: input.status ?? 'PENDING_ACTIVATION',
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
    externalAccountId: input.externalAccountId,
    availableBalanceCents: input.openingBalanceCents,
    ledgerBalanceCents: input.openingBalanceCents
  };
}

export function canActivateAccount(status: AccountStatus): boolean {
  return status === 'PENDING_ACTIVATION';
}
