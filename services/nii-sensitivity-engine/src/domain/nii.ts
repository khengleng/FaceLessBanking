export interface RepricingBucketData {
  bucketName: string;
  gapCents: bigint; // Assets - Liabilities
  // Representing the average time (in years) remaining in the 1-year horizon after repricing
  // e.g., for 0-30 days (15 days average), a 1-year horizon has ~11.5 months (0.96 years) remaining
  timeRemainingYears: number; 
}

export interface ScenarioShock {
  scenarioId: string;
  name: string;
  basisPointsShift: number; // e.g. +200 or -100
}

export interface NIISensitivityResult {
  scenarioId: string;
  currency: string;
  basisPointsShift: number;
  projectedNiiDeltaCents: bigint;
  baselineNiiAnnualizedCents: bigint;
  projectedNewNiiCents: bigint;
  niiDeltaPercentage: number;
}
