import { apiClient, type ApiClient } from './client';

export type LiquidityPosition = {
  currency: string;
  availableCashCents: bigint;
  reservedCashCents: bigint;
  outgoingPendingCents: bigint;
  incomingPendingCents: bigint;
  updatedAt: string;
};

export type TreasuryAccount = {
  accountId: string;
  currency: string;
  balanceCents: bigint;
  type: string;
};

export type ALMSummary = {
  totalAssetsCents: bigint;
  totalLiabilitiesCents: bigint;
  netPositionCents: bigint;
  currenciesCount: number;
};

export type MaturityBucket = {
  bucketKey: string;
  inflowCents: bigint;
  outflowCents: bigint;
  netGapCents: bigint;
  currency: string;
};

export type RepricingGap = {
  bucketCode: string;
  repricingAssetsCents: bigint;
  repricingLiabilitiesCents: bigint;
  gapCents: bigint;
  cumulativeGapCents: bigint;
};

export type TreasuryOverview = {
  liquidityPositions: LiquidityPosition[];
  treasuryAccounts: TreasuryAccount[];
  almSummary: ALMSummary | null;
  maturityBuckets: MaturityBucket[];
  repricingGaps: RepricingGap[];
  warnings: string[];
};

export interface TreasuryClient {
  getOverview(currency?: string): Promise<TreasuryOverview>;
}

export class HttpTreasuryClient implements TreasuryClient {
  constructor(private readonly client: ApiClient = apiClient) {}

  async getOverview(currency?: string): Promise<TreasuryOverview> {
    const warnings: string[] = [];

    const [liquidityResult, treasuryResult, almSummaryResult, maturityResult, repricingResult] = await Promise.allSettled([
      this.fetchLiquidityPositions(),
      this.fetchTreasuryAccounts(),
      this.fetchALMSummary(),
      this.fetchMaturityBuckets(currency),
      this.fetchRepricingGaps(currency)
    ]);

    return {
      liquidityPositions: unwrap(liquidityResult, [], warnings, 'liquidity_positions_unavailable'),
      treasuryAccounts: unwrap(treasuryResult, [], warnings, 'treasury_accounts_unavailable'),
      almSummary: unwrap(almSummaryResult, null, warnings, 'alm_summary_unavailable'),
      maturityBuckets: unwrap(maturityResult, [], warnings, 'alm_maturity_buckets_unavailable'),
      repricingGaps: unwrap(repricingResult, [], warnings, 'repricing_gaps_unavailable'),
      warnings
    };
  }

  private async fetchLiquidityPositions(): Promise<LiquidityPosition[]> {
    const response = await this.client.request<unknown>('/liquidity/positions');
    const rows = extractArray(response, ['data', 'items', 'data.items']);

    return rows.map((row) => {
      const node = selectDataNode(row);
      return {
        currency: readString(node, ['currency']) ?? 'USD',
        availableCashCents: readBigInt(node, ['availableCash']),
        reservedCashCents: readBigInt(node, ['reservedCash']),
        outgoingPendingCents: readBigInt(node, ['outgoingPending']),
        incomingPendingCents: readBigInt(node, ['incomingPending']),
        updatedAt: readString(node, ['updatedAt']) ?? new Date(0).toISOString()
      };
    });
  }

  private async fetchTreasuryAccounts(): Promise<TreasuryAccount[]> {
    const response = await this.client.request<unknown>('/treasury/accounts');
    const rows = extractArray(response, ['data', 'items', 'data.items']);

    return rows.map((row) => {
      const node = selectDataNode(row);
      return {
        accountId: readString(node, ['accountId']) ?? 'unknown-account',
        currency: readString(node, ['currency']) ?? 'USD',
        balanceCents: readBigInt(node, ['balanceCents']),
        type: readString(node, ['type']) ?? 'UNKNOWN'
      };
    });
  }

  private async fetchALMSummary(): Promise<ALMSummary> {
    const response = await this.client.request<unknown>('/alm/summary');
    const node = selectDataNode(response);

    return {
      totalAssetsCents: readBigInt(node, ['totalAssets']),
      totalLiabilitiesCents: readBigInt(node, ['totalLiabilities']),
      netPositionCents: readBigInt(node, ['netPosition']),
      currenciesCount: readNumber(node, ['currenciesCount']) ?? 0
    };
  }

  private async fetchMaturityBuckets(currency?: string): Promise<MaturityBucket[]> {
    const query = currency ? `?currency=${encodeURIComponent(currency)}` : '';
    const response = await this.client.request<unknown>(`/alm/maturity-buckets${query}`);
    const rows = extractArray(response, ['data', 'items', 'data.items']);

    return rows.map((row) => {
      const node = selectDataNode(row);
      return {
        bucketKey: readString(node, ['bucketKey']) ?? 'UNKNOWN',
        inflowCents: readBigInt(node, ['inflowCents']),
        outflowCents: readBigInt(node, ['outflowCents']),
        netGapCents: readBigInt(node, ['netGapCents']),
        currency: readString(node, ['currency']) ?? currency ?? 'USD'
      };
    });
  }

  private async fetchRepricingGaps(currency?: string): Promise<RepricingGap[]> {
    const path = currency ? `/irr/repricing-gaps/${encodeURIComponent(currency)}` : '/irr/repricing-gaps';
    const response = await this.client.request<unknown>(path);
    const rows = extractArray(response, ['data', 'items', 'data.items']);

    return rows.map((row, index) => {
      const node = selectDataNode(row);

      return {
        bucketCode: readString(node, ['bucketCode']) ?? readString(node, ['bucket']) ?? `bucket-${index + 1}`,
        repricingAssetsCents: readBigInt(node, ['repricingAssets']),
        repricingLiabilitiesCents: readBigInt(node, ['repricingLiabilities']),
        gapCents: readBigInt(node, ['gap']),
        cumulativeGapCents: readBigInt(node, ['cumulativeGap'])
      };
    });
  }
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

function readBigInt(value: unknown, path: string[]): bigint {
  const found = readUnknown(value, path);

  if (typeof found === 'string' && found.trim().length > 0) {
    return BigInt(found);
  }

  if (typeof found === 'number' && Number.isFinite(found)) {
    return BigInt(Math.trunc(found));
  }

  return 0n;
}
