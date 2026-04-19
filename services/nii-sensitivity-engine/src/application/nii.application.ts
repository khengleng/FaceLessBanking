import type { ScenarioShock, NIISensitivityResult } from '../domain/nii.js';
import type { IrrEngineAdapter, AccountingAdapter } from '../adapters/nii-adapters.js';

export class NIIApplication {
  constructor(
    private readonly irrAdapter: IrrEngineAdapter,
    private readonly accountingAdapter: AccountingAdapter,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async getBaselineNii(currency: string): Promise<{ currency: string, baselineAnnualizedCents: bigint }> {
    const baseline = await this.accountingAdapter.fetchBaselineAnnualizedNii(currency);
    return { currency, baselineAnnualizedCents: baseline };
  }

  async calculateShockImpact(currency: string, shock: ScenarioShock): Promise<NIISensitivityResult> {
    const gaps = await this.irrAdapter.fetchRepricingGaps(currency);
    const baselineNii = await this.accountingAdapter.fetchBaselineAnnualizedNii(currency);

    // Marginal Impact = Gap * (bpShift / 10000) * TimeRemaining
    let projectedDeltaCents = 0n;

    for (const gap of gaps) {
      if (gap.timeRemainingYears > 0) {
        // Convert BP to a multiplier (e.g., 200 bps = 0.02)
        const rateShiftFloat = shock.basisPointsShift / 10000;
        
        // Impact = Gap * RateShift * TimeRemaining
        // We use Number for intermediate float math, then convert back to BigInt
        const gapNum = Number(gap.gapCents);
        const marginalImpact = gapNum * rateShiftFloat * gap.timeRemainingYears;
        
        projectedDeltaCents += BigInt(Math.round(marginalImpact));
      }
    }

    const projectedNewNiiCents = baselineNii + projectedDeltaCents;
    
    const percentageNum = baselineNii === 0n 
      ? 0 
      : (Number(projectedDeltaCents) / Number(baselineNii)) * 100;

    this.logger.info({ scenarioId: shock.scenarioId, projectedDeltaCents: projectedDeltaCents.toString() }, 'Calculated shock impact');

    return {
      scenarioId: shock.scenarioId,
      currency,
      basisPointsShift: shock.basisPointsShift,
      projectedNiiDeltaCents: projectedDeltaCents,
      baselineNiiAnnualizedCents: baselineNii,
      projectedNewNiiCents,
      niiDeltaPercentage: Math.round(percentageNum * 100) / 100 // Round to 2 decimal places
    };
  }

  async executeStandardScenarios(currency: string): Promise<NIISensitivityResult[]> {
    const scenarios: ScenarioShock[] = [
      { scenarioId: 'PARALLEL_UP_100', name: 'Parallel Up 100 bps', basisPointsShift: 100 },
      { scenarioId: 'PARALLEL_UP_200', name: 'Parallel Up 200 bps', basisPointsShift: 200 },
      { scenarioId: 'PARALLEL_DOWN_100', name: 'Parallel Down 100 bps', basisPointsShift: -100 },
      { scenarioId: 'PARALLEL_DOWN_200', name: 'Parallel Down 200 bps', basisPointsShift: -200 }
    ];

    const results: NIISensitivityResult[] = [];
    for (const scenario of scenarios) {
      results.push(await this.calculateShockImpact(currency, scenario));
    }

    return results;
  }
}
