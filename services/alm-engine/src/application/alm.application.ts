import type { 
  ALMPosition, 
  MaturityBucket, 
  MaturityBucketKey
} from '../domain/alm.js';
import type { PostgresALMAdapter } from '../adapters/postgres-alm.adapter.js';

type ALMLogger = {
  info: (payload: Record<string, unknown>, message: string) => void;
  warn: (payload: Record<string, unknown>, message: string) => void;
  error: (payload: Record<string, unknown>, message: string) => void;
};

export class ALMApplication {
  constructor(
    private readonly postgresAdapter: PostgresALMAdapter,
    private readonly logger: ALMLogger
  ) {}

  async aggregatePositions(): Promise<ALMPosition[]> {
    const loans = await this.postgresAdapter.fetchLoanPositions();
    const deposits = await this.postgresAdapter.fetchDepositPositions();
    const treasury = await this.postgresAdapter.fetchTreasuryPositions();

    const allPositions = [...loans, ...deposits, ...treasury];
    const currencyMap = new Map<string, { assets: bigint; liabilities: bigint }>();

    for (const pos of allPositions) {
      const current = currencyMap.get(pos.currency) || { assets: 0n, liabilities: 0n };
      if (pos.type === 'ASSET') {
        current.assets += pos.amountCents;
      } else {
        current.liabilities += pos.amountCents;
      }
      currencyMap.set(pos.currency, current);
    }

    const aggregated: ALMPosition[] = Array.from(currencyMap.entries()).map(([currency, data]) => ({
      currency,
      totalAssetsCents: data.assets,
      totalLiabilitiesCents: data.liabilities,
      netPositionCents: data.assets - data.liabilities,
      updatedAt: new Date().toISOString()
    }));

    this.logger.info({ count: aggregated.length }, 'Completed ALM position aggregation');
    return aggregated;
  }

  async calculateMaturityBuckets(currency: string): Promise<MaturityBucket[]> {
    const loanSchedules = await this.postgresAdapter.fetchLoanSchedules();
    const depositMaturities = await this.postgresAdapter.fetchDepositMaturities();

    const allFlows = [
      ...loanSchedules.filter(f => f.currency === currency),
      ...depositMaturities.filter(f => f.currency === currency)
    ];

    const buckets: Record<MaturityBucketKey, { inflow: bigint; outflow: bigint }> = {
      '0_7_DAYS': { inflow: 0n, outflow: 0n },
      '8_30_DAYS': { inflow: 0n, outflow: 0n },
      '1_3_MONTHS': { inflow: 0n, outflow: 0n },
      '3_6_MONTHS': { inflow: 0n, outflow: 0n },
      '6_12_MONTHS': { inflow: 0n, outflow: 0n },
      'OVER_1_YEAR': { inflow: 0n, outflow: 0n }
    };

    for (const flow of allFlows) {
      const bucketKey = this.mapDateToBucketKey(new Date(flow.dueDate));
      if (flow.type === 'INFLOW') {
        buckets[bucketKey].inflow += flow.amountCents;
      } else {
        buckets[bucketKey].outflow += flow.amountCents;
      }
    }

    return Object.entries(buckets).map(([key, data]) => ({
      bucketKey: key as MaturityBucketKey,
      inflowCents: data.inflow,
      outflowCents: data.outflow,
      netGapCents: data.inflow - data.outflow,
      currency
    }));
  }

  private mapDateToBucketKey(dueDate: Date): MaturityBucketKey {
    const now = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) return '0_7_DAYS';
    if (diffDays <= 30) return '8_30_DAYS';
    if (diffDays <= 90) return '1_3_MONTHS';
    if (diffDays <= 180) return '3_6_MONTHS';
    if (diffDays <= 365) return '6_12_MONTHS';
    return 'OVER_1_YEAR';
  }

  async calculateRiskMetrics(currency: string) {
    const position = await this.getPositionByCurrency(currency);
    const buckets = await this.calculateMaturityBuckets(currency);

    if (!position) {
      return null;
    }

    const totalAssets = position.totalAssetsCents;
    const totalLiabilities = position.totalLiabilitiesCents;

    // 1. Liquidity Gap
    const liquidityGap = totalAssets - totalLiabilities;

    // 2. A/L Ratio (Solvency)
    const alRatio = totalLiabilities === 0n ? 0 : Number(totalAssets * 10000n / totalLiabilities) / 10000;

    // 3. Short-term Gap (0-30 days)
    const stBuckets = buckets.filter(b => b.bucketKey === '0_7_DAYS' || b.bucketKey === '8_30_DAYS');
    const stInflow = stBuckets.reduce((acc, b) => acc + b.inflowCents, 0n);
    const stOutflow = stBuckets.reduce((acc, b) => acc + b.outflowCents, 0n);
    const shortTermGap = stInflow - stOutflow;

    // 4. Funding Gap Ratio (ST Outflow / ST Inflow or similar)
    // Using (ST Inflow / ST Outflow) as a coverage ratio
    const fundingGapRatio = stOutflow === 0n ? 0 : Number(stInflow * 10000n / stOutflow) / 10000;

    return {
      currency,
      liquidityGapCents: liquidityGap.toString(),
      alRatio,
      shortTermGapCents: shortTermGap.toString(),
      fundingCoverageRatio: fundingGapRatio,
      updatedAt: new Date().toISOString()
    };
  }

  async getPositionByCurrency(currency: string): Promise<ALMPosition | null> {
    const all = await this.aggregatePositions();
    return all.find(p => p.currency === currency) ?? null;
  }
}
