import type { 
  SearchAdapter, 
  DashboardFilters,
  SummaryMetrics, 
  DashboardPayment, 
  DashboardLoan, 
  DashboardOnboarding, 
  DashboardDispute 
} from '../domain/dashboard.js';

export class MockSearchAdapter implements SearchAdapter {
  async getSummaryMetrics(): Promise<SummaryMetrics> {
    return {
      totalPayments: 1250,
      totalLoans: 45,
      onboardingStatusCounts: {
        'PENDING': 12,
        'IN_REVIEW': 5,
        'APPROVED': 150
      },
      disputesOpen: 8,
      failedTransactions: 24,
      updatedAt: new Date().toISOString()
    };
  }

  async searchPayments(params: DashboardFilters): Promise<{ items: DashboardPayment[]; total: number }> {
    void params;
    const items: DashboardPayment[] = [
      { paymentId: 'pay-1', customerId: 'cust-101', amount: 150.50, currency: 'USD', status: 'COMPLETED', createdAt: '2026-04-15T10:00:00Z' },
      { paymentId: 'pay-2', customerId: 'cust-102', amount: 3000.00, currency: 'USD', status: 'FAILED', createdAt: '2026-04-15T11:30:00Z' }
    ];
    return { items, total: 2 };
  }

  async searchLoans(params: DashboardFilters): Promise<{ items: DashboardLoan[]; total: number }> {
    void params;
    const items: DashboardLoan[] = [
      { loanId: 'loan-1', customerId: 'cust-101', amount: 5000.00, status: 'ACTIVE', createdAt: '2026-04-10T14:00:00Z' }
    ];
    return { items, total: 1 };
  }

  async searchOnboarding(params: DashboardFilters): Promise<{ items: DashboardOnboarding[]; total: number }> {
    void params;
    const items: DashboardOnboarding[] = [
      { caseId: 'case-1', customerId: 'cust-201', status: 'IN_REVIEW', createdAt: '2026-04-14T09:00:00Z' }
    ];
    return { items, total: 1 };
  }

  async searchDisputes(params: DashboardFilters): Promise<{ items: DashboardDispute[]; total: number }> {
    void params;
    const items: DashboardDispute[] = [
      { disputeId: 'disp-1', entityId: 'pay-2', status: 'OPEN', severity: 'HIGH', createdAt: '2026-04-15T12:00:00Z' }
    ];
    return { items, total: 1 };
  }
}
