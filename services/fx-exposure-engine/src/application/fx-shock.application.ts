import type { FxExposureAdapter } from '../adapters/fx-exposure.adapter.js';
import type { FXShockResult, FXShockRun, FXShockScenario } from '../domain/fx-shock.js';

export class FxShockApplication {
  private shockScenariosRun = 0;
  private totalShockCalculationLatencyMs = 0;
  private missingFxRateErrors = 0;

  private readonly standardScenarioDefinitions = new Map<string, { name: string; shockPercent: number }>([
    ['FX_UP_5_PERCENT', { name: 'FX Up 5 Percent', shockPercent: 5 }],
    ['FX_DOWN_5_PERCENT', { name: 'FX Down 5 Percent', shockPercent: -5 }],
    ['FX_UP_10_PERCENT', { name: 'FX Up 10 Percent', shockPercent: 10 }],
    ['FX_DOWN_10_PERCENT', { name: 'FX Down 10 Percent', shockPercent: -10 }]
  ]);

  private readonly scenarioRuns = new Map<string, FXShockRun>();

  constructor(
    private readonly fxExposureAdapter: FxExposureAdapter,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  getScenarios(reportingCurrency = 'USD'): FXShockScenario[] {
    const now = new Date().toISOString();
    const normalizedReportingCurrency = reportingCurrency.toUpperCase();

    return [...this.standardScenarioDefinitions.entries()].map(([scenarioId, definition]) => ({
      scenarioId,
      scenarioName: definition.name,
      shockPercent: definition.shockPercent,
      reportingCurrency: normalizedReportingCurrency,
      createdAt: now
    }));
  }

  async runScenario(input: {
    scenarioId?: string;
    shockPercent?: number;
    reportingCurrency?: string;
  }): Promise<FXShockRun> {
    const startedAt = Date.now();
    const reportingCurrency = (input.reportingCurrency ?? 'USD').toUpperCase();

    const scenario = this.resolveScenario({
      scenarioId: input.scenarioId,
      shockPercent: input.shockPercent,
      reportingCurrency
    });

    const exposures = await this.fxExposureAdapter.getCurrentCurrencyExposures(reportingCurrency);
    const calculatedAt = new Date().toISOString();

    const results: FXShockResult[] = exposures.map((exposure) => {
      const originalNetPosition = exposure.netOpenPosition;
      const originalReportingValue = exposure.reportingValue;

      if (originalReportingValue === undefined) {
        this.missingFxRateErrors += 1;
        this.logger.warn(
          {
            currency: exposure.currency,
            scenarioId: scenario.scenarioId,
            reportingCurrency
          },
          'Skipping FX shock valuation for missing baseline reporting value'
        );

        return {
          currency: exposure.currency,
          originalNetPosition,
          originalReportingValue: '0',
          shockedReportingValue: '0',
          deltaValue: '0',
          scenarioName: scenario.scenarioName,
          calculatedAt,
          valuationStatus: 'MISSING_RATE'
        };
      }

      if (exposure.currency === reportingCurrency) {
        return {
          currency: exposure.currency,
          originalNetPosition,
          originalReportingValue,
          shockedReportingValue: originalReportingValue,
          deltaValue: '0',
          scenarioName: scenario.scenarioName,
          calculatedAt
        };
      }

      const shockedReportingValue = applyShockPercent(BigInt(originalReportingValue), scenario.shockPercent);
      const deltaValue = shockedReportingValue - BigInt(originalReportingValue);

      return {
        currency: exposure.currency,
        originalNetPosition,
        originalReportingValue,
        shockedReportingValue: shockedReportingValue.toString(),
        deltaValue: deltaValue.toString(),
        scenarioName: scenario.scenarioName,
        calculatedAt
      };
    });

    const run: FXShockRun = {
      scenario,
      results,
      calculatedAt
    };

    this.scenarioRuns.set(this.buildRunKey(scenario.scenarioId, reportingCurrency), run);

    const latencyMs = Date.now() - startedAt;
    this.shockScenariosRun += 1;
    this.totalShockCalculationLatencyMs += latencyMs;

    this.logger.info(
      {
        scenarioId: scenario.scenarioId,
        reportingCurrency,
        shockPercent: scenario.shockPercent,
        resultCount: results.length,
        latencyMs,
        shockScenariosRun: this.shockScenariosRun
      },
      'Completed FX shock scenario run'
    );

    return run;
  }

  async getScenarioResult(scenarioId: string, reportingCurrency = 'USD'): Promise<FXShockRun | null> {
    return this.scenarioRuns.get(this.buildRunKey(scenarioId, reportingCurrency.toUpperCase())) ?? null;
  }

  getMetrics(): {
    shockScenariosRun: number;
    shockCalculationLatencyMs: number;
    averageShockCalculationLatencyMs: number;
    missingFxRateErrors: number;
  } {
    return {
      shockScenariosRun: this.shockScenariosRun,
      shockCalculationLatencyMs: this.totalShockCalculationLatencyMs,
      averageShockCalculationLatencyMs: this.shockScenariosRun === 0
        ? 0
        : this.totalShockCalculationLatencyMs / this.shockScenariosRun,
      missingFxRateErrors: this.missingFxRateErrors
    };
  }

  private resolveScenario(input: {
    scenarioId?: string;
    shockPercent?: number;
    reportingCurrency: string;
  }): FXShockScenario {
    const now = new Date().toISOString();

    if (input.scenarioId) {
      const standard = this.standardScenarioDefinitions.get(input.scenarioId);
      if (!standard) {
        throw new Error('scenario_not_found');
      }

      return {
        scenarioId: input.scenarioId,
        scenarioName: standard.name,
        shockPercent: standard.shockPercent,
        reportingCurrency: input.reportingCurrency,
        createdAt: now
      };
    }

    if (input.shockPercent === undefined) {
      throw new Error('invalid_scenario_request');
    }

    return {
      scenarioId: `CUSTOM_${normalizeShockId(input.shockPercent)}`,
      scenarioName: `Custom FX Shock ${input.shockPercent}%`,
      shockPercent: input.shockPercent,
      reportingCurrency: input.reportingCurrency,
      createdAt: now
    };
  }

  private buildRunKey(scenarioId: string, reportingCurrency: string): string {
    return `${scenarioId}:${reportingCurrency}`;
  }
}

function applyShockPercent(originalValue: bigint, shockPercent: number): bigint {
  const shockBasisPoints = Math.round(shockPercent * 100);
  const numerator = BigInt(10_000 + shockBasisPoints);
  const denominator = 10_000n;
  const product = originalValue * numerator;

  const adjustment = product >= 0n ? denominator / 2n : -(denominator / 2n);
  return (product + adjustment) / denominator;
}

function normalizeShockId(shockPercent: number): string {
  return shockPercent.toString().replace('.', '_').replace('-', 'NEG_');
}
