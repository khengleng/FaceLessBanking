import type {
  CustomerAccountView,
  CustomerLoanView,
  CustomerOnboardingStatusView,
  CustomerProfileView,
  CustomerProfitabilityView,
  CustomerTransactionView
} from '../domain/customer-360.js';

export class Customer360SourcesAdapter {
  private readonly profileByCustomer = new Map<string, CustomerProfileView>([
    [
      'cust-001',
      {
        customerId: 'cust-001',
        status: 'ACTIVE',
        onboardingReference: 'onb-001',
        verificationStatus: 'APPROVED',
        createdAt: '2026-04-16T00:30:00.000Z'
      }
    ]
  ]);

  private readonly onboardingStatusByCustomer = new Map<string, CustomerOnboardingStatusView>([
    [
      'cust-001',
      {
        caseStatus: 'APPROVED',
        ekycStatus: 'APPROVED',
        lastUpdatedAt: '2026-04-16T00:45:00.000Z'
      }
    ]
  ]);

  private readonly accountsByCustomer = new Map<string, CustomerAccountView[]>([
    [
      'cust-001',
      [
        {
          accountId: 'acc-001',
          status: 'ACTIVE',
          currency: 'USD',
          createdAt: '2026-04-16T01:00:00.000Z'
        }
      ]
    ]
  ]);

  private readonly loansByCustomer = new Map<string, CustomerLoanView[]>([
    [
      'cust-001',
      [
        {
          loanId: 'loan-001',
          status: 'DISBURSED',
          principalAmount: 5000,
          currency: 'USD',
          createdAt: '2026-04-16T02:00:00.000Z'
        }
      ]
    ]
  ]);

  private readonly transactionsByCustomer = new Map<string, CustomerTransactionView[]>([
    [
      'cust-001',
      [
        {
          transactionId: 'txn-001',
          type: 'INTERNAL_TRANSFER',
          amount: 120.5,
          currency: 'USD',
          status: 'COMPLETED',
          createdAt: '2026-04-16T03:00:00.000Z'
        },
        {
          transactionId: 'txn-002',
          type: 'LOAN_REPAYMENT',
          amount: 75,
          currency: 'USD',
          status: 'COMPLETED',
          createdAt: '2026-04-16T04:00:00.000Z'
        }
      ]
    ]
  ]);

  private readonly profitabilityByCustomer = new Map<string, CustomerProfitabilityView>([
    [
      'cust-001',
      {
        totalRevenue: 120,
        totalCost: 20,
        netProfit: 100,
        currency: 'USD'
      }
    ]
  ]);

  async getAccountsByCustomerId(customerId: string): Promise<CustomerAccountView[]> {
    return (this.accountsByCustomer.get(customerId) ?? []).map((item) => structuredClone(item));
  }

  async getProfileByCustomerId(customerId: string): Promise<CustomerProfileView | null> {
    const value = this.profileByCustomer.get(customerId);
    return value ? structuredClone(value) : null;
  }

  async getOnboardingStatusByCustomerId(customerId: string): Promise<CustomerOnboardingStatusView | null> {
    const value = this.onboardingStatusByCustomer.get(customerId);
    return value ? structuredClone(value) : null;
  }

  async getLoansByCustomerId(customerId: string): Promise<CustomerLoanView[]> {
    return (this.loansByCustomer.get(customerId) ?? []).map((item) => structuredClone(item));
  }

  async getTransactionsByCustomerId(customerId: string): Promise<CustomerTransactionView[]> {
    return (this.transactionsByCustomer.get(customerId) ?? []).map((item) => structuredClone(item));
  }

  async getProfitabilityByCustomerId(customerId: string): Promise<CustomerProfitabilityView | null> {
    const value = this.profitabilityByCustomer.get(customerId);
    return value ? structuredClone(value) : null;
  }
}
