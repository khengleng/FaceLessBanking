import { apiClient, type ApiClient } from './client';

export type TransferPricingResult = {
  fee: number;
  totalAmount: number;
};

export type FxPricingResult = {
  baseRate: number;
  spread: number;
  finalRate: number;
  convertedAmount: number;
};

export interface PricingUiClient {
  calculateTransferPricing(input: {
    amount: number;
    currency: string;
    transferType: 'INTERNAL' | 'EXTERNAL' | 'INSTANT';
  }): Promise<TransferPricingResult>;
  calculateFxPricing(input: {
    baseCurrency: string;
    quoteCurrency: string;
    amount: number;
  }): Promise<FxPricingResult>;
}

export class HttpPricingUiClient implements PricingUiClient {
  constructor(private readonly client: ApiClient = apiClient) {}

  async calculateTransferPricing(input: {
    amount: number;
    currency: string;
    transferType: 'INTERNAL' | 'EXTERNAL' | 'INSTANT';
  }): Promise<TransferPricingResult> {
    const response = await this.client.request<unknown>('/pricing/transfers/calculate', {
      method: 'POST',
      body: input
    });

    const node = selectDataNode(response);

    return {
      fee: readNumber(node, ['fee']) ?? 0,
      totalAmount: readNumber(node, ['totalAmount']) ?? 0
    };
  }

  async calculateFxPricing(input: {
    baseCurrency: string;
    quoteCurrency: string;
    amount: number;
  }): Promise<FxPricingResult> {
    const response = await this.client.request<unknown>('/pricing/fx/calculate', {
      method: 'POST',
      body: input
    });

    const node = selectDataNode(response);

    return {
      baseRate: readNumber(node, ['baseRate']) ?? 0,
      spread: readNumber(node, ['spread']) ?? 0,
      finalRate: readNumber(node, ['finalRate']) ?? 0,
      convertedAmount: readNumber(node, ['convertedAmount']) ?? 0
    };
  }
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

function readNumber(value: unknown, path: string[]): number | undefined {
  const found = readUnknown(value, path);
  return typeof found === 'number' ? found : undefined;
}
