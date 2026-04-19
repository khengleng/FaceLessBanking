import type { AnalyticsDataset, SourceRecord } from '../domain/data-pipeline.js';

export class SourceDataAdapter {
  private readonly datasetMap: Record<AnalyticsDataset, SourceRecord[]> = {
    customers: [
      {
        customerId: 'cust-001',
        status: 'ACTIVE',
        onboardingReference: 'onb-001',
        createdAt: '2026-04-16T00:00:00.000Z'
      },
      {
        customerId: 'cust-002',
        status: 'VERIFIED',
        onboardingReference: 'onb-002',
        createdAt: '2026-04-16T01:00:00.000Z'
      }
    ],
    accounts: [
      {
        accountId: 'acc-001',
        customerId: 'cust-001',
        status: 'ACTIVE',
        currency: 'USD',
        createdAt: '2026-04-16T02:00:00.000Z'
      },
      {
        accountId: 'acc-002',
        customerId: 'cust-002',
        status: 'PENDING_ACTIVATION',
        currency: 'USD',
        createdAt: '2026-04-16T03:00:00.000Z'
      }
    ],
    loans: [
      {
        loanId: 'loan-001',
        customerId: 'cust-001',
        status: 'DISBURSED',
        principalAmount: 5000,
        currency: 'USD',
        createdAt: '2026-04-16T03:30:00.000Z'
      },
      {
        loanId: 'loan-002',
        customerId: 'cust-002',
        status: 'PENDING_APPROVAL',
        principalAmount: 1200,
        currency: 'USD',
        createdAt: '2026-04-16T03:45:00.000Z'
      }
    ],
    payments: [
      {
        paymentId: 'pay-001',
        sourceAccountId: 'acc-001',
        destinationAccountId: 'acc-002',
        amount: 120.5,
        currency: 'USD',
        status: 'COMPLETED',
        createdAt: '2026-04-16T04:00:00.000Z'
      },
      {
        paymentId: 'pay-002',
        sourceAccountId: 'acc-002',
        destinationAccountId: 'acc-001',
        amount: 45,
        currency: 'USD',
        status: 'FAILED',
        createdAt: '2026-04-16T05:00:00.000Z'
      }
    ],
    profitability: [
      {
        entityType: 'CUSTOMER',
        entityId: 'cust-001',
        totalRevenue: 120,
        totalCost: 20,
        netProfit: 100,
        currency: 'USD',
        createdAt: '2026-04-16T06:00:00.000Z'
      },
      {
        entityType: 'CUSTOMER',
        entityId: 'cust-002',
        totalRevenue: 30,
        totalCost: 10,
        netProfit: 20,
        currency: 'USD',
        createdAt: '2026-04-16T06:05:00.000Z'
      }
    ]
  };

  async fetchDataset(dataset: AnalyticsDataset): Promise<SourceRecord[]> {
    return this.datasetMap[dataset].map((row) => structuredClone(row));
  }
}
