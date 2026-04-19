export type CurrencyAggregatePosition = {
  currency: string;
  amountCents: bigint;
};

export type CurrencyExposure = {
  currency: string;
  grossAssets: string;
  grossLiabilities: string;
  netOpenPosition: string;
  reportingCurrency?: string;
  reportingValue?: string;
  updatedAt: string;
};

export type ExposureSummary = {
  reportingCurrency?: string;
  totalGrossAssets: string;
  totalGrossLiabilities: string;
  totalNetOpenPosition: string;
  totalReportingValue?: string;
  missingRateCurrencies?: string[];
  updatedAt: string;
};

export type FxRateQuote = {
  baseCurrency: string;
  quoteCurrency: string;
  rateValue: string;
  effectiveAt: string;
};
