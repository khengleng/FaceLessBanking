import type { CurrencyAggregatePosition } from '../domain/exposure.js';

export interface PostgresExposureAdapter {
  fetchLoanAssetPositionsByCurrency(): Promise<CurrencyAggregatePosition[]>;
  fetchDepositLiabilityPositionsByCurrency(): Promise<CurrencyAggregatePosition[]>;
  fetchTreasuryPositionsByCurrency(): Promise<CurrencyAggregatePosition[]>;
}

export class InMemoryPostgresExposureAdapter implements PostgresExposureAdapter {
  async fetchLoanAssetPositionsByCurrency(): Promise<CurrencyAggregatePosition[]> {
    return [
      { currency: 'USD', amountCents: 8_000_000n },
      { currency: 'EUR', amountCents: 3_000_000n },
      { currency: 'KHR', amountCents: 4_000_000n }
    ];
  }

  async fetchDepositLiabilityPositionsByCurrency(): Promise<CurrencyAggregatePosition[]> {
    return [
      { currency: 'USD', amountCents: 6_000_000n },
      { currency: 'EUR', amountCents: 2_500_000n },
      { currency: 'KHR', amountCents: 5_000_000n }
    ];
  }

  async fetchTreasuryPositionsByCurrency(): Promise<CurrencyAggregatePosition[]> {
    return [
      { currency: 'USD', amountCents: 500_000n },
      { currency: 'EUR', amountCents: -200_000n },
      { currency: 'KHR', amountCents: 100_000n }
    ];
  }
}
