export interface Currency {
  currencyCode: string; // e.g. "USD"
  currencyName: string; // e.g. "US Dollar"
  decimalPlaces: number; // e.g. 2
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface FXRate {
  rateId: string;
  baseCurrency: string; // e.g. "USD"
  quoteCurrency: string; // e.g. "EUR"
  rateType: 'SPOT'; // Placeholder per requirements
  rateValue: string; // Stored as a high-precision decimal string
  effectiveAt: string;
  version: number;
  createdAt: string;
}

export interface FXRateUpdatedPayload {
  rateId: string;
  baseCurrency: string;
  quoteCurrency: string;
  rateType: 'SPOT';
  rateValue: string;
  effectiveAt: string;
}
