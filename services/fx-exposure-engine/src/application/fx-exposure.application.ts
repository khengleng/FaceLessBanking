import type { FxRateAdapter } from '../adapters/fx-rate.adapter.js';
import type { PostgresExposureAdapter } from '../adapters/postgres-exposure.adapter.js';
import type { CurrencyExposure, ExposureSummary } from '../domain/exposure.js';

export class FxExposureApplication {
  private exposureCalculationsRun = 0;
  private valuationRequestsRun = 0;
  private missingRateErrors = 0;

  constructor(
    private readonly postgresAdapter: PostgresExposureAdapter,
    private readonly fxRateAdapter: FxRateAdapter,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async getExposures(reportingCurrency?: string): Promise<CurrencyExposure[]> {
    this.exposureCalculationsRun += 1;

    const normalizedReporting = reportingCurrency?.toUpperCase();
    if (normalizedReporting) {
      this.valuationRequestsRun += 1;
    }

    const [loanAssets, depositLiabilities, treasuryPositions] = await Promise.all([
      this.postgresAdapter.fetchLoanAssetPositionsByCurrency(),
      this.postgresAdapter.fetchDepositLiabilityPositionsByCurrency(),
      this.postgresAdapter.fetchTreasuryPositionsByCurrency()
    ]);

    const grossAssetsByCurrency = new Map<string, bigint>();
    const grossLiabilitiesByCurrency = new Map<string, bigint>();

    for (const position of loanAssets) {
      const currency = position.currency.toUpperCase();
      grossAssetsByCurrency.set(currency, (grossAssetsByCurrency.get(currency) ?? 0n) + position.amountCents);
    }

    for (const position of depositLiabilities) {
      const currency = position.currency.toUpperCase();
      grossLiabilitiesByCurrency.set(currency, (grossLiabilitiesByCurrency.get(currency) ?? 0n) + position.amountCents);
    }

    // Treasury/funding positions are mapped explicitly:
    // positive balances increase gross assets; negative balances increase gross liabilities.
    for (const position of treasuryPositions) {
      const currency = position.currency.toUpperCase();
      if (position.amountCents >= 0n) {
        grossAssetsByCurrency.set(currency, (grossAssetsByCurrency.get(currency) ?? 0n) + position.amountCents);
      } else {
        const liabilityIncrease = position.amountCents * -1n;
        grossLiabilitiesByCurrency.set(currency, (grossLiabilitiesByCurrency.get(currency) ?? 0n) + liabilityIncrease);
      }
    }

    const currencies = new Set<string>([
      ...grossAssetsByCurrency.keys(),
      ...grossLiabilitiesByCurrency.keys()
    ]);

    const now = new Date().toISOString();
    const exposures: CurrencyExposure[] = [];

    for (const currency of [...currencies].sort()) {
      const grossAssets = grossAssetsByCurrency.get(currency) ?? 0n;
      const grossLiabilities = grossLiabilitiesByCurrency.get(currency) ?? 0n;
      const netOpenPosition = grossAssets - grossLiabilities;

      const exposure: CurrencyExposure = {
        currency,
        grossAssets: grossAssets.toString(),
        grossLiabilities: grossLiabilities.toString(),
        netOpenPosition: netOpenPosition.toString(),
        updatedAt: now
      };

      if (normalizedReporting) {
        exposure.reportingCurrency = normalizedReporting;

        if (currency === normalizedReporting) {
          exposure.reportingValue = netOpenPosition.toString();
        } else {
          const rate = await this.fxRateAdapter.getLatestFxRate(currency, normalizedReporting);
          if (!rate) {
            this.missingRateErrors += 1;
            this.logger.warn({ currency, reportingCurrency: normalizedReporting }, 'Missing FX rate for valuation');
          } else {
            exposure.reportingValue = multiplyAmountByRate(netOpenPosition, rate.rateValue).toString();
          }
        }
      }

      exposures.push(exposure);
    }

    this.logger.info(
      {
        reportingCurrency: normalizedReporting,
        exposureCount: exposures.length,
        exposureCalculationsRun: this.exposureCalculationsRun
      },
      'Computed FX exposures by currency'
    );

    return exposures;
  }

  async getExposureByCurrency(currency: string, reportingCurrency?: string): Promise<CurrencyExposure | null> {
    const normalizedCurrency = currency.toUpperCase();
    const exposures = await this.getExposures(reportingCurrency);

    return exposures.find((exposure) => exposure.currency === normalizedCurrency) ?? null;
  }

  async getExposureSummary(reportingCurrency?: string): Promise<ExposureSummary> {
    const exposures = await this.getExposures(reportingCurrency);

    const totalGrossAssets = exposures.reduce((sum, row) => sum + BigInt(row.grossAssets), 0n);
    const totalGrossLiabilities = exposures.reduce((sum, row) => sum + BigInt(row.grossLiabilities), 0n);
    const totalNetOpenPosition = exposures.reduce((sum, row) => sum + BigInt(row.netOpenPosition), 0n);

    const summary: ExposureSummary = {
      reportingCurrency: reportingCurrency?.toUpperCase(),
      totalGrossAssets: totalGrossAssets.toString(),
      totalGrossLiabilities: totalGrossLiabilities.toString(),
      totalNetOpenPosition: totalNetOpenPosition.toString(),
      updatedAt: new Date().toISOString()
    };

    if (reportingCurrency) {
      const missingRateCurrencies: string[] = [];
      let totalReportingValue = 0n;

      for (const row of exposures) {
        if (row.reportingValue === undefined) {
          missingRateCurrencies.push(row.currency);
          continue;
        }

        totalReportingValue += BigInt(row.reportingValue);
      }

      summary.totalReportingValue = totalReportingValue.toString();
      if (missingRateCurrencies.length > 0) {
        summary.missingRateCurrencies = missingRateCurrencies;
      }
    }

    return summary;
  }

  getMetrics(): {
    exposureCalculationsRun: number;
    valuationRequestsRun: number;
    missingRateErrors: number;
  } {
    return {
      exposureCalculationsRun: this.exposureCalculationsRun,
      valuationRequestsRun: this.valuationRequestsRun,
      missingRateErrors: this.missingRateErrors
    };
  }
}

function multiplyAmountByRate(amountCents: bigint, rateValue: string): bigint {
  const [whole, fraction = ''] = rateValue.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const numerator = BigInt(`${whole}${fraction}`);

  const product = amountCents * numerator;
  if (scale === 0n) {
    return product;
  }

  // Rounded half-up placeholder for deterministic valuation.
  const adjustment = product >= 0n ? scale / 2n : -(scale / 2n);
  return (product + adjustment) / scale;
}
