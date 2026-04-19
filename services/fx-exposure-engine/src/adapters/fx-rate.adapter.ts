import type { FxRateQuote } from '../domain/exposure.js';

export interface FxRateAdapter {
  getLatestFxRate(baseCurrency: string, quoteCurrency: string): Promise<FxRateQuote | null>;
}

export class InMemoryFxRateAdapter implements FxRateAdapter {
  private readonly rates = new Map<string, FxRateQuote>([
    ['EUR:USD', {
      baseCurrency: 'EUR',
      quoteCurrency: 'USD',
      rateValue: '1.1000',
      effectiveAt: '2026-04-17T00:00:00.000Z'
    }],
    ['KHR:USD', {
      baseCurrency: 'KHR',
      quoteCurrency: 'USD',
      rateValue: '0.00025',
      effectiveAt: '2026-04-17T00:00:00.000Z'
    }],
    ['USD:EUR', {
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      rateValue: '0.909090',
      effectiveAt: '2026-04-17T00:00:00.000Z'
    }]
  ]);

  async getLatestFxRate(baseCurrency: string, quoteCurrency: string): Promise<FxRateQuote | null> {
    return this.rates.get(`${baseCurrency}:${quoteCurrency}`) ?? null;
  }
}
