export interface ALMPosition {
  currency: string;
  totalAssetsCents: bigint;
  totalLiabilitiesCents: bigint;
  netPositionCents: bigint;
  updatedAt: string;
}

export interface ALMSummary {
  positions: ALMPosition[];
  totalAssetsUSD: string;
  totalLiabilitiesUSD: string;
  netPositionUSD: string;
}

export type MaturityBucketKey = 
  | '0_7_DAYS' 
  | '8_30_DAYS' 
  | '1_3_MONTHS' 
  | '3_6_MONTHS' 
  | '6_12_MONTHS' 
  | 'OVER_1_YEAR';

export interface MaturityBucket {
  bucketKey: MaturityBucketKey;
  inflowCents: bigint;
  outflowCents: bigint;
  netGapCents: bigint;
  currency: string;
}

export type RawPosition = {
  currency: string;
  amountCents: bigint;
  type: 'ASSET' | 'LIABILITY';
};

export type ScheduledCashFlow = {
  amountCents: bigint;
  dueDate: string;
  currency: string;
  type: 'INFLOW' | 'OUTFLOW';
};
