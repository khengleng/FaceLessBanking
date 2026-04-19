import type {
  FXSpreadRule,
  TransferPricingRule,
  TransferType
} from '../domain/pricing.js';

export interface FXRateServiceAdapter {
  getLatestFxRate(baseCurrency: string, quoteCurrency: string): Promise<{ rateValue: string } | null>;
}

export interface RulesEngineAdapter {
  getTransferPricingRules(transferType: TransferType): Promise<TransferPricingRule>;
  getFxSpreadRules(baseCurrency: string, quoteCurrency: string, amount: number): Promise<FXSpreadRule>;
}

export class MockFXRateServiceAdapter implements FXRateServiceAdapter {
  private readonly rates = new Map<string, string>([
    ['USD:EUR', '0.92'],
    ['EUR:USD', '1.10'],
    ['USD:KHR', '4100'],
    ['KHR:USD', '0.00024']
  ]);

  async getLatestFxRate(baseCurrency: string, quoteCurrency: string): Promise<{ rateValue: string } | null> {
    const rateValue = this.rates.get(`${baseCurrency.toUpperCase()}:${quoteCurrency.toUpperCase()}`);
    if (!rateValue) {
      return null;
    }

    return { rateValue };
  }
}

export class MockRulesEngineAdapter implements RulesEngineAdapter {
  async getTransferPricingRules(transferType: TransferType): Promise<TransferPricingRule> {
    if (transferType === 'INTERNAL') {
      return { transferType, flatFee: 0.25, percentBps: 10 };
    }

    if (transferType === 'EXTERNAL') {
      return { transferType, flatFee: 0.75, percentBps: 25 };
    }

    return { transferType: 'INSTANT', flatFee: 1.25, percentBps: 40 };
  }

  async getFxSpreadRules(baseCurrency: string, quoteCurrency: string, amount: number): Promise<FXSpreadRule> {
    const pair = `${baseCurrency.toUpperCase()}:${quoteCurrency.toUpperCase()}`;

    if (pair === 'USD:KHR' || pair === 'KHR:USD') {
      if (amount < 1_000) {
        return { spread: 0.0025 };
      }

      if (amount < 10_000) {
        return { spread: 0.0018 };
      }

      return { spread: 0.0012 };
    }

    if (amount < 1_000) {
      return { spread: 0.0015 };
    }

    if (amount < 10_000) {
      return { spread: 0.0010 };
    }

    return { spread: 0.0007 };
  }
}
