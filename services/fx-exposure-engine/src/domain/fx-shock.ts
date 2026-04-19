export type FXShockScenario = {
  scenarioId: string;
  scenarioName: string;
  shockPercent: number;
  reportingCurrency: string;
  createdAt: string;
};

export type FXShockResult = {
  currency: string;
  originalNetPosition: string;
  originalReportingValue: string;
  shockedReportingValue: string;
  deltaValue: string;
  scenarioName: string;
  calculatedAt: string;
  valuationStatus?: 'MISSING_RATE';
};

export type FXShockRun = {
  scenario: FXShockScenario;
  results: FXShockResult[];
  calculatedAt: string;
};
