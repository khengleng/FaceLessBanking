export type RepricingBucketKey = 
  | '0_30_DAYS' 
  | '31_90_DAYS' 
  | '3_6_MONTHS' 
  | '6_12_MONTHS' 
  | '1_3_YEARS' 
  | 'OVER_3_YEARS';

export interface RepricingBucket {
  bucketName: RepricingBucketKey;
  repricingAssets: bigint;
  repricingLiabilities: bigint;
  gap: bigint;
  cumulativeGap: bigint;
  currency: string;
}

export interface RateSensitivePosition {
  instrumentId: string;
  currency: string;
  amountCents: bigint;
  type: 'ASSET' | 'LIABILITY';
  nextRepricingDate: string;
  // A simplified placeholder for current yield/cost for base NII
  rateBasisPoints: number; 
}

export interface NIISensitivityResult {
  currency: string;
  baseNii: string;
  shockedNii: string;
  deltaNii: string;
  shockBps: number;
  calculatedAt: string;
}

export type ShockType = 'PARALLEL' | 'FLATTENER' | 'STEEPENER';

export interface IRRScenario {
  scenarioId: string;
  scenarioName: string;
  shockType: ShockType;
  shockBps: number;
  createdAt: string;
}

export interface IRRScenarioResult {
  scenarioId: string;
  currency: string;
  repricingGapImpact: string; // Placeholder
  niiDelta: string;
  notes: string; // Placeholder
  calculatedAt: string;
}

export interface ScenarioExecutionMetrics {
  executionCount: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
}
