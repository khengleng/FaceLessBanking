import type { 
  RepricingBucket, 
  RepricingBucketKey, 
  RateSensitivePosition,
  NIISensitivityResult,
  IRRScenario,
  IRRScenarioResult,
  ScenarioExecutionMetrics
} from '../domain/irr.js';
import type { PostgresIRRAdapter } from '../adapters/postgres-irr.adapter.js';

type Logger = {
  info: (payload: Record<string, unknown>, message: string) => void;
  warn: (payload: Record<string, unknown>, message: string) => void;
  error: (payload: Record<string, unknown>, message: string) => void;
};

export class IRRApplication {
  private scenarioExecutionCount = 0;
  private scenarioExecutionTotalLatencyMs = 0;

  constructor(
    private readonly postgresAdapter: PostgresIRRAdapter,
    private readonly logger: Logger
  ) {}

  async calculateRepricingGaps(currency: string): Promise<RepricingBucket[]> {
    const allPositions = await this.getAllPositions(currency);

    const buckets: Record<RepricingBucketKey, { assets: bigint; liabilities: bigint }> = {
      '0_30_DAYS': { assets: 0n, liabilities: 0n },
      '31_90_DAYS': { assets: 0n, liabilities: 0n },
      '3_6_MONTHS': { assets: 0n, liabilities: 0n },
      '6_12_MONTHS': { assets: 0n, liabilities: 0n },
      '1_3_YEARS': { assets: 0n, liabilities: 0n },
      'OVER_3_YEARS': { assets: 0n, liabilities: 0n }
    };

    for (const pos of allPositions) {
      const bucketKey = this.mapDateToBucketKey(new Date(pos.nextRepricingDate));
      if (pos.type === 'ASSET') {
        buckets[bucketKey].assets += pos.amountCents;
      } else {
        buckets[bucketKey].liabilities += pos.amountCents;
      }
    }

    const orderedKeys: RepricingBucketKey[] = [
      '0_30_DAYS',
      '31_90_DAYS',
      '3_6_MONTHS',
      '6_12_MONTHS',
      '1_3_YEARS',
      'OVER_3_YEARS'
    ];

    let cumulativeGap = 0n;
    const result: RepricingBucket[] = orderedKeys.map(key => {
      const data = buckets[key];
      const gap = data.assets - data.liabilities;
      cumulativeGap += gap;
      
      return {
        bucketName: key,
        repricingAssets: data.assets,
        repricingLiabilities: data.liabilities,
        gap,
        cumulativeGap,
        currency
      };
    });

    this.logger.info({ currency }, 'Completed IRR repricing gap calculation');
    return result;
  }

  async calculateNIISensitivity(currency: string, shockBps: number): Promise<NIISensitivityResult> {
    const allPositions = await this.getAllPositions(currency);

    let baseNiiAnnualized = 0n;
    let shockedNiiAnnualized = 0n;

    for (const pos of allPositions) {
      // Calculate annualized income/expense for this position
      const currentRatePct = pos.rateBasisPoints / 10000;
      const shockedRatePct = (pos.rateBasisPoints + shockBps) / 10000;

      const baseAmount = Number(pos.amountCents) * currentRatePct;
      const shockedAmount = Number(pos.amountCents) * shockedRatePct;

      if (pos.type === 'ASSET') {
        baseNiiAnnualized += BigInt(Math.round(baseAmount));
        shockedNiiAnnualized += BigInt(Math.round(shockedAmount));
      } else {
        baseNiiAnnualized -= BigInt(Math.round(baseAmount));
        shockedNiiAnnualized -= BigInt(Math.round(shockedAmount));
      }
    }

    const deltaNii = shockedNiiAnnualized - baseNiiAnnualized;

    this.logger.info({ currency, shockBps, deltaNii: deltaNii.toString() }, 'Calculated NII sensitivity');

    return {
      currency,
      baseNii: baseNiiAnnualized.toString(),
      shockedNii: shockedNiiAnnualized.toString(),
      deltaNii: deltaNii.toString(),
      shockBps,
      calculatedAt: new Date().toISOString()
    };
  }

  getScenarios(): IRRScenario[] {
    const defaultDate = new Date().toISOString();
    return [
      { scenarioId: 'UP_100_BPS', scenarioName: 'Parallel Up 100 bps', shockType: 'PARALLEL', shockBps: 100, createdAt: defaultDate },
      { scenarioId: 'DOWN_100_BPS', scenarioName: 'Parallel Down 100 bps', shockType: 'PARALLEL', shockBps: -100, createdAt: defaultDate },
      { scenarioId: 'UP_200_BPS', scenarioName: 'Parallel Up 200 bps', shockType: 'PARALLEL', shockBps: 200, createdAt: defaultDate },
      { scenarioId: 'DOWN_200_BPS', scenarioName: 'Parallel Down 200 bps', shockType: 'PARALLEL', shockBps: -200, createdAt: defaultDate },
      { scenarioId: 'FLATTENER', scenarioName: 'Yield Curve Flattener (Placeholder)', shockType: 'FLATTENER', shockBps: 0, createdAt: defaultDate },
      { scenarioId: 'STEEPENER', scenarioName: 'Yield Curve Steepener (Placeholder)', shockType: 'STEEPENER', shockBps: 0, createdAt: defaultDate }
    ];
  }

  async runScenario(input: {
    scenarioId: string;
    currency: string;
    customShockBps?: number;
  }): Promise<IRRScenarioResult> {
    const startedAt = Date.now();
    const scenarios = this.getScenarios();
    const scenario = scenarios.find((item) => item.scenarioId === input.scenarioId);
    const isCustomScenario = input.scenarioId === 'CUSTOM_SCENARIO';

    if (!scenario && !isCustomScenario) {
      throw new Error('scenario_not_found');
    }

    const shockBps = input.customShockBps !== undefined
      ? input.customShockBps
      : (scenario?.shockBps ?? 0);

    const niiResult = await this.calculateNIISensitivity(input.currency, shockBps);

    const result: IRRScenarioResult = {
      scenarioId: input.scenarioId,
      currency: input.currency,
      repricingGapImpact: 'Requires Yield Curve Extrapolation (Placeholder)',
      niiDelta: niiResult.deltaNii,
      notes: scenario?.shockType !== 'PARALLEL'
        ? 'Scenario requires non-parallel basis shifts.'
        : 'Parallel shock successful.',
      calculatedAt: new Date().toISOString()
    };

    await this.postgresAdapter.createScenarioResult(result);

    const latencyMs = Date.now() - startedAt;
    this.recordScenarioExecutionLatency(latencyMs);
    this.logger.info(
      {
        scenarioId: input.scenarioId,
        currency: input.currency,
        shockBps,
        latencyMs,
        executionCount: this.scenarioExecutionCount
      },
      'Executed IRR scenario'
    );

    return result;
  }

  async getScenarioResult(scenarioId: string, currency: string): Promise<IRRScenarioResult | null> {
    return this.postgresAdapter.getScenarioResult(scenarioId, currency);
  }

  getScenarioExecutionMetrics(): ScenarioExecutionMetrics {
    return {
      executionCount: this.scenarioExecutionCount,
      totalLatencyMs: this.scenarioExecutionTotalLatencyMs,
      averageLatencyMs: this.scenarioExecutionCount === 0
        ? 0
        : this.scenarioExecutionTotalLatencyMs / this.scenarioExecutionCount
    };
  }

  private recordScenarioExecutionLatency(latencyMs: number): void {
    this.scenarioExecutionCount += 1;
    this.scenarioExecutionTotalLatencyMs += latencyMs;
  }

  private async getAllPositions(currency: string): Promise<RateSensitivePosition[]> {
    const assets = await this.postgresAdapter.fetchRateSensitiveLoanPositions();
    const liabilities = await this.postgresAdapter.fetchRateSensitiveDepositPositions();
    const treasury = await this.postgresAdapter.fetchTreasuryRateSensitivePositions();

    return [
      ...assets.filter(a => a.currency === currency),
      ...liabilities.filter(l => l.currency === currency),
      ...treasury.filter(t => t.currency === currency)
    ];
  }

  private mapDateToBucketKey(repricingDate: Date): RepricingBucketKey {
    const now = new Date();
    const diffDays = Math.ceil((repricingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) return '0_30_DAYS';
    if (diffDays <= 90) return '31_90_DAYS';
    if (diffDays <= 180) return '3_6_MONTHS';
    if (diffDays <= 365) return '6_12_MONTHS';
    if (diffDays <= 1095) return '1_3_YEARS'; // 3 years
    return 'OVER_3_YEARS';
  }
}
