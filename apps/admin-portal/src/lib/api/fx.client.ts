import { apiClient, type ApiClient } from './client';

export type FxRate = {
  rateId: string;
  baseCurrency: string;
  quoteCurrency: string;
  rateType: string;
  rateValue: string;
  effectiveAt: string;
  version: number;
  createdAt: string;
};

export type FxExposureSummary = {
  reportingCurrency: string;
  totalGrossAssets: string;
  totalGrossLiabilities: string;
  totalNetOpenPosition: string;
  totalReportingValue?: string;
  updatedAt: string;
};

export type FxShockScenario = {
  scenarioId: string;
  scenarioName: string;
  shockPercent: number;
  reportingCurrency: string;
  createdAt: string;
};

export type FxShockRunResult = {
  scenarioId: string;
  scenarioName: string;
  reportingCurrency: string;
  calculatedAt: string;
  results: Array<{
    currency: string;
    originalNetPosition: string;
    originalReportingValue: string;
    shockedReportingValue: string;
    deltaValue: string;
    scenarioName: string;
    calculatedAt: string;
  }>;
};

export type FxOverviewBundle = {
  latestRate: FxRate | null;
  exposureSummary: FxExposureSummary | null;
  scenarios: FxShockScenario[];
  latestShockRun: FxShockRunResult | null;
  warnings: string[];
};

export interface FxClient {
  getOverview(input: {
    baseCurrency: string;
    quoteCurrency: string;
    reportingCurrency: string;
  }): Promise<FxOverviewBundle>;
  runScenario(input: { scenarioId: string; reportingCurrency: string }): Promise<FxShockRunResult>;
}

export class HttpFxClient implements FxClient {
  constructor(private readonly client: ApiClient = apiClient) {}

  async getOverview(input: {
    baseCurrency: string;
    quoteCurrency: string;
    reportingCurrency: string;
  }): Promise<FxOverviewBundle> {
    const warnings: string[] = [];

    const [latestRateResult, summaryResult, scenariosResult] = await Promise.allSettled([
      this.getLatestRate(input.baseCurrency, input.quoteCurrency),
      this.getExposureSummary(input.reportingCurrency),
      this.getScenarios(input.reportingCurrency)
    ]);

    return {
      latestRate: unwrap(latestRateResult, null, warnings, 'fx_latest_rate_unavailable'),
      exposureSummary: unwrap(summaryResult, null, warnings, 'fx_exposure_summary_unavailable'),
      scenarios: unwrap(scenariosResult, [], warnings, 'fx_shock_scenarios_unavailable'),
      latestShockRun: null,
      warnings
    };
  }

  async runScenario(input: { scenarioId: string; reportingCurrency: string }): Promise<FxShockRunResult> {
    const response = await this.client.request<unknown>('/fx/shocks/run', {
      method: 'POST',
      body: {
        scenarioId: input.scenarioId,
        reportingCurrency: input.reportingCurrency
      }
    });

    return mapShockRun(selectDataNode(response));
  }

  private async getLatestRate(base: string, quote: string): Promise<FxRate> {
    const response = await this.client.request<unknown>(`/fx/rates/latest?base=${encodeURIComponent(base)}&quote=${encodeURIComponent(quote)}`);
    return mapFxRate(selectDataNode(response));
  }

  private async getExposureSummary(reportingCurrency: string): Promise<FxExposureSummary> {
    const response = await this.client.request<unknown>(`/fx/exposures/summary?reportingCurrency=${encodeURIComponent(reportingCurrency)}`);
    const node = selectDataNode(response);

    return {
      reportingCurrency: readString(node, ['reportingCurrency']) ?? reportingCurrency,
      totalGrossAssets: readString(node, ['totalGrossAssets']) ?? '0',
      totalGrossLiabilities: readString(node, ['totalGrossLiabilities']) ?? '0',
      totalNetOpenPosition: readString(node, ['totalNetOpenPosition']) ?? '0',
      totalReportingValue: readString(node, ['totalReportingValue']),
      updatedAt: readString(node, ['updatedAt']) ?? new Date(0).toISOString()
    };
  }

  private async getScenarios(reportingCurrency: string): Promise<FxShockScenario[]> {
    const response = await this.client.request<unknown>(`/fx/shocks/scenarios?reportingCurrency=${encodeURIComponent(reportingCurrency)}`);
    const rows = extractArray(response, ['data', 'items', 'data.items']);
    return rows.map((row) => {
      const node = selectDataNode(row);
      return {
        scenarioId: readString(node, ['scenarioId']) ?? 'UNKNOWN_SCENARIO',
        scenarioName: readString(node, ['scenarioName']) ?? 'Unknown',
        shockPercent: readNumber(node, ['shockPercent']) ?? 0,
        reportingCurrency: readString(node, ['reportingCurrency']) ?? reportingCurrency,
        createdAt: readString(node, ['createdAt']) ?? new Date(0).toISOString()
      };
    });
  }
}

function mapFxRate(node: unknown): FxRate {
  return {
    rateId: readString(node, ['rateId']) ?? 'unknown-rate',
    baseCurrency: readString(node, ['baseCurrency']) ?? 'USD',
    quoteCurrency: readString(node, ['quoteCurrency']) ?? 'USD',
    rateType: readString(node, ['rateType']) ?? 'SPOT',
    rateValue: readString(node, ['rateValue']) ?? '0',
    effectiveAt: readString(node, ['effectiveAt']) ?? new Date(0).toISOString(),
    version: readNumber(node, ['version']) ?? 0,
    createdAt: readString(node, ['createdAt']) ?? new Date(0).toISOString()
  };
}

function mapShockRun(node: unknown): FxShockRunResult {
  return {
    scenarioId: readString(node, ['scenarioId']) ?? 'UNKNOWN_SCENARIO',
    scenarioName: readString(node, ['scenarioName']) ?? 'Unknown',
    reportingCurrency: readString(node, ['reportingCurrency']) ?? 'USD',
    calculatedAt: readString(node, ['calculatedAt']) ?? new Date(0).toISOString(),
    results: extractArray(node, ['results']).map((result) => ({
      currency: readString(result, ['currency']) ?? 'USD',
      originalNetPosition: readString(result, ['originalNetPosition']) ?? '0',
      originalReportingValue: readString(result, ['originalReportingValue']) ?? '0',
      shockedReportingValue: readString(result, ['shockedReportingValue']) ?? '0',
      deltaValue: readString(result, ['deltaValue']) ?? '0',
      scenarioName: readString(result, ['scenarioName']) ?? 'Unknown',
      calculatedAt: readString(result, ['calculatedAt']) ?? new Date(0).toISOString()
    }))
  };
}

function unwrap<T>(
  settled: PromiseSettledResult<T>,
  fallback: T,
  warnings: string[],
  warningCode: string
): T {
  if (settled.status === 'fulfilled') {
    return settled.value;
  }

  warnings.push(warningCode);
  return fallback;
}

function selectDataNode(value: unknown): unknown {
  const data = readUnknown(value, ['data']);
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data;
  }

  return value;
}

function extractArray(value: unknown, pathHints: string[]): unknown[] {
  for (const hint of pathHints) {
    const found = readUnknown(value, hint.split('.'));
    if (Array.isArray(found)) {
      return found;
    }
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

function readUnknown(value: unknown, path: string[]): unknown {
  let current: unknown = value;

  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function readString(value: unknown, path: string[]): string | undefined {
  const found = readUnknown(value, path);
  return typeof found === 'string' ? found : undefined;
}

function readNumber(value: unknown, path: string[]): number | undefined {
  const found = readUnknown(value, path);
  return typeof found === 'number' ? found : undefined;
}
