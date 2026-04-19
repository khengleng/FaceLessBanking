export type TransferType = 'INTERNAL' | 'EXTERNAL' | 'INSTANT';

export type TransferPricingRequest = {
  amount: number;
  currency: string;
  transferType: TransferType;
};

export type TransferPricingResult = {
  fee: number;
  totalAmount: number;
};

export type FXPricingRequest = {
  baseCurrency: string;
  quoteCurrency: string;
  amount: number;
};

export type FXPricingResult = {
  baseRate: number;
  spread: number;
  finalRate: number;
  convertedAmount: number;
};

export type TransferPricingRule = {
  transferType: TransferType;
  flatFee: number;
  percentBps: number;
};

export type FXSpreadRule = {
  spread: number;
};
