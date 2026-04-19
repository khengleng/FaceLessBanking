export type CustomerAccountView = {
  accountId: string;
  status: string;
  currency: string;
  createdAt: string;
};

export type CustomerProfileView = {
  customerId: string;
  status: string;
  onboardingReference: string | null;
  verificationStatus: string;
  createdAt: string | null;
};

export type CustomerOnboardingStatusView = {
  caseStatus: string;
  ekycStatus: string;
  lastUpdatedAt: string | null;
};

export type CustomerLoanView = {
  loanId: string;
  status: string;
  principalAmount: number;
  currency: string;
  createdAt: string;
};

export type CustomerTransactionView = {
  transactionId: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

export type CustomerProfitabilityView = {
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  currency: string;
};

export type Customer360View = {
  customerId: string;
  profile: CustomerProfileView;
  onboardingStatus: CustomerOnboardingStatusView;
  accounts: CustomerAccountView[];
  loans: CustomerLoanView[];
  transactions: CustomerTransactionView[];
  profitability: CustomerProfitabilityView;
  generatedAt: string;
};

export function buildEmptyCustomer360(customerId: string): Customer360View {
  return {
    customerId,
    profile: {
      customerId,
      status: 'UNKNOWN',
      onboardingReference: null,
      verificationStatus: 'UNVERIFIED',
      createdAt: null
    },
    onboardingStatus: {
      caseStatus: 'UNKNOWN',
      ekycStatus: 'UNKNOWN',
      lastUpdatedAt: null
    },
    accounts: [],
    loans: [],
    transactions: [],
    profitability: {
      totalRevenue: 0,
      totalCost: 0,
      netProfit: 0,
      currency: 'USD'
    },
    generatedAt: new Date().toISOString()
  };
}
