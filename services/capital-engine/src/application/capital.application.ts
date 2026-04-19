import type { BalanceDataAdapter, LoanDataAdapter } from '../adapters/capital.adapters.js';
import { RISK_WEIGHTS, type CARResult, type RWA, type RWAResult } from '../domain/capital.js';

type Logger = {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

export class CapitalApplication {
  constructor(
    private readonly loanDataAdapter: LoanDataAdapter,
    private readonly balanceDataAdapter: BalanceDataAdapter,
    private readonly logger: Logger
  ) {}

  async getRWA(currency: string): Promise<RWAResult> {
    const normalizedCurrency = currency.toUpperCase();
    const exposures = await this.loanDataAdapter.getLoanExposures(normalizedCurrency);

    const rows: RWA[] = exposures.map((item) => {
      const riskWeight = RISK_WEIGHTS[item.assetType] ?? RISK_WEIGHTS.OTHER;
      return {
        assetType: item.assetType,
        exposure: roundToScale(item.exposure, 6),
        riskWeight,
        rwaValue: roundToScale(item.exposure * riskWeight, 6)
      };
    });

    const totalRwa = roundToScale(rows.reduce((sum, row) => sum + row.rwaValue, 0), 6);

    this.logger.info({ currency: normalizedCurrency, rowCount: rows.length, totalRwa }, 'Calculated RWA');

    return {
      currency: normalizedCurrency,
      rows,
      totalRwa,
      calculatedAt: new Date().toISOString()
    };
  }

  async getCAR(currency: string): Promise<CARResult> {
    const normalizedCurrency = currency.toUpperCase();
    const [rwa, capitalBase] = await Promise.all([
      this.getRWA(normalizedCurrency),
      this.balanceDataAdapter.getCapitalBase(normalizedCurrency)
    ]);

    const car = safeDivide(capitalBase.capital, rwa.totalRwa);

    this.logger.info(
      { currency: normalizedCurrency, capital: capitalBase.capital, totalRwa: rwa.totalRwa, car },
      'Calculated capital adequacy ratio'
    );

    return {
      capital: roundToScale(capitalBase.capital, 6),
      totalRwa: rwa.totalRwa,
      car,
      currency: normalizedCurrency,
      calculatedAt: new Date().toISOString()
    };
  }
}

function roundToScale(value: number, scale: number): number {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
}

function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return roundToScale(numerator / denominator, 6);
}
