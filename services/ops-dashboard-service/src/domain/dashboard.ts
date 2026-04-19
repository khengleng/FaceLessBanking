export type SummaryMetrics = {
  totalPayments: number;
  totalLoans: number;
  onboardingStatusCounts: Record<string, number>;
  disputesOpen: number;
  failedTransactions: number;
  updatedAt: string;
};

export type DashboardPayment = {
  paymentId: string;
  customerId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

export type DashboardLoan = {
  loanId: string;
  customerId: string;
  amount: number;
  status: string;
  createdAt: string;
};

export type DashboardOnboarding = {
  caseId: string;
  customerId: string;
  status: string;
  createdAt: string;
};

export type DashboardDispute = {
  disputeId: string;
  entityId: string;
  status: string;
  severity: string;
  createdAt: string;
};

export type DashboardFilters = {
  status?: string;
  customerId?: string;
  limit: number;
  offset: number;
};

export interface SearchAdapter {
  getSummaryMetrics(): Promise<SummaryMetrics>;
  searchPayments(filters: DashboardFilters): Promise<{ items: DashboardPayment[]; total: number }>;
  searchLoans(filters: DashboardFilters): Promise<{ items: DashboardLoan[]; total: number }>;
  searchOnboarding(filters: DashboardFilters): Promise<{ items: DashboardOnboarding[]; total: number }>;
  searchDisputes(filters: DashboardFilters): Promise<{ items: DashboardDispute[]; total: number }>;
}
