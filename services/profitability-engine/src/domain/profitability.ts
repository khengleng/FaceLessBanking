export type RevenueCostCategory =
  | 'INTEREST_INCOME'
  | 'FEE_INCOME'
  | 'FX_INCOME'
  | 'FUNDING_COST';

export interface RevenueCostRecord {
  recordId: string;
  sourceEventId: string;
  category: RevenueCostCategory;
  amount: number;
  currency: string;
  relatedEntityId: string;
  createdAt: string;
}

export interface ProfitabilityView {
  entityId: string;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  currency: string;
}

export interface EntityOwnership {
  customerId?: string;
  productType?: string;
}

export type SupportedFinancialEventType =
  | 'loan.interest.accrued.v1'
  | 'fee.collected.v1'
  | 'payment.status.updated.v1'
  | 'fx.rate.applied';

export interface FinancialEventEnvelope {
  specVersion: string;
  type: string;
  version: number;
  metadata: {
    eventId: string;
    correlationId: string;
    causationId?: string;
    timestamp: string;
    producer: string;
  };
  payload: Record<string, unknown>;
}

export interface CreateRevenueCostRecordInput {
  sourceEventId: string;
  category: RevenueCostCategory;
  amount: number;
  currency: string;
  relatedEntityId: string;
  createdAt: string;
}

export interface BankPnL {
  totalInterestIncome: number;
  totalFeeIncome: number;
  totalFxIncome: number;
  totalCost: number;
  netProfit: number;
  currency: string;
  calculatedAt: string;
}

export interface MarginMetrics {
  netInterestMargin: number | null;
  costOfFunds: number | null;
  yieldOnAssets: number | null;
}

export interface RevenueCostAggregate {
  interestIncome: number;
  feeIncome: number;
  fxIncome: number;
  totalCost: number;
  interestExpense: number;
  currency: string;
  calculatedAt: string;
}
