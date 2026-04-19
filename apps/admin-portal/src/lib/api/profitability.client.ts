import { apiClient, type ApiClient } from './client';

export type ProfitabilityView = {
  entityId: string;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  currency: string;
};

export type BankPnLSummary = {
  totalInterestIncome: number;
  totalFeeIncome: number;
  totalFxIncome: number;
  totalCost: number;
  netProfit: number;
  currency: string;
  calculatedAt: string;
};

export type MarginMetrics = {
  netInterestMargin: number;
  costOfFunds: number;
  yieldOnAssets: number;
};

export interface ProfitabilityClient {
  getCustomerProfitability(customerId: string): Promise<ProfitabilityView>;
  getProductProfitability(productType: string): Promise<ProfitabilityView>;
  getBankPnL(currency?: string): Promise<BankPnLSummary>;
  getMargins(currency?: string): Promise<MarginMetrics>;
}

export class HttpProfitabilityClient implements ProfitabilityClient {
  constructor(private readonly client: ApiClient = apiClient) {}

  async getCustomerProfitability(customerId: string): Promise<ProfitabilityView> {
    const response = await this.client.request<unknown>(`/profitability/customers/${encodeURIComponent(customerId)}`);
    return mapProfitabilityView(selectDataNode(response), customerId);
  }

  async getProductProfitability(productType: string): Promise<ProfitabilityView> {
    const response = await this.client.request<unknown>(`/profitability/products/${encodeURIComponent(productType)}`);
    return mapProfitabilityView(selectDataNode(response), productType);
  }

  async getBankPnL(currency = 'USD'): Promise<BankPnLSummary> {
    const response = await this.client.request<unknown>(`/profitability/pnl?currency=${encodeURIComponent(currency)}`);
    const node = selectDataNode(response);

    return {
      totalInterestIncome: readNumber(node, ['totalInterestIncome']) ?? 0,
      totalFeeIncome: readNumber(node, ['totalFeeIncome']) ?? 0,
      totalFxIncome: readNumber(node, ['totalFxIncome']) ?? 0,
      totalCost: readNumber(node, ['totalCost']) ?? 0,
      netProfit: readNumber(node, ['netProfit']) ?? 0,
      currency: readString(node, ['currency']) ?? currency,
      calculatedAt: readString(node, ['calculatedAt']) ?? new Date(0).toISOString()
    };
  }

  async getMargins(currency = 'USD'): Promise<MarginMetrics> {
    const response = await this.client.request<unknown>(`/profitability/margins?currency=${encodeURIComponent(currency)}`);
    const node = selectDataNode(response);

    return {
      netInterestMargin: readNumber(node, ['netInterestMargin']) ?? 0,
      costOfFunds: readNumber(node, ['costOfFunds']) ?? 0,
      yieldOnAssets: readNumber(node, ['yieldOnAssets']) ?? 0
    };
  }
}

function mapProfitabilityView(value: unknown, fallbackEntityId: string): ProfitabilityView {
  return {
    entityId: readString(value, ['entityId']) ?? fallbackEntityId,
    totalRevenue: readNumber(value, ['totalRevenue']) ?? 0,
    totalCost: readNumber(value, ['totalCost']) ?? 0,
    netProfit: readNumber(value, ['netProfit']) ?? 0,
    currency: readString(value, ['currency']) ?? 'USD'
  };
}

function selectDataNode(value: unknown): unknown {
  const data = readUnknown(value, ['data']);
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data;
  }

  return value;
}

function readUnknown(value: unknown, path: string[]): unknown {
  let current: unknown = value;

  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function readString(value: unknown, path: string[]): string | undefined {
  const found = readUnknown(value, path);
  return typeof found === 'string' ? found : undefined;
}

function readNumber(value: unknown, path: string[]): number | undefined {
  const found = readUnknown(value, path);
  return typeof found === 'number' ? found : undefined;
}
