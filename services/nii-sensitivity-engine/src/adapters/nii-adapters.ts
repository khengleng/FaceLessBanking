import type { RepricingBucketData } from '../domain/nii.js';

export interface IrrEngineAdapter {
  fetchRepricingGaps(currency: string): Promise<RepricingBucketData[]>;
}

export class IrrEngineAdapterStub implements IrrEngineAdapter {
  async fetchRepricingGaps(currency: string): Promise<RepricingBucketData[]> {
    // Mock data reflecting what interest-rate-risk-engine would return,
    // plus our calculated time remaining in a 1-year horizon.
    if (currency === 'USD') {
      return [
        { bucketName: '0_30_DAYS', gapCents: 5000000n, timeRemainingYears: 0.96 }, // Asset sensitive
        { bucketName: '31_90_DAYS', gapCents: -2000000n, timeRemainingYears: 0.83 }, // Liability sensitive
        { bucketName: '3_6_MONTHS', gapCents: 1000000n, timeRemainingYears: 0.62 },
        { bucketName: '6_12_MONTHS', gapCents: -500000n, timeRemainingYears: 0.25 },
        { bucketName: '1_3_YEARS', gapCents: 10000000n, timeRemainingYears: 0 }, // No impact in 1yr horizon
        { bucketName: 'OVER_3_YEARS', gapCents: 3000000n, timeRemainingYears: 0 }
      ];
    }
    return [];
  }
}

export interface AccountingAdapter {
  fetchBaselineAnnualizedNii(currency: string): Promise<bigint>;
}

export class AccountingAdapterStub implements AccountingAdapter {
  async fetchBaselineAnnualizedNii(currency: string): Promise<bigint> {
    if (currency !== 'USD') {
      return 50000000n;
    }
    // Mock baseline NII of $1,000,000 annualized
    return 100000000n;
  }
}
