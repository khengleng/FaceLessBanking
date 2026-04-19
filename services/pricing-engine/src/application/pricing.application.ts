import type { FXPricingRequest, FXPricingResult, TransferPricingRequest, TransferPricingResult } from '../domain/pricing.js';
import type { FXRateServiceAdapter, RulesEngineAdapter } from '../adapters/pricing-adapters.js';

export class PricingApplication {
  constructor(
    private readonly rulesAdapter: RulesEngineAdapter,
    private readonly fxRateAdapter: FXRateServiceAdapter,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async calculateTransferPricing(request: TransferPricingRequest): Promise<TransferPricingResult> {
    const rule = await this.rulesAdapter.getTransferPricingRules(request.transferType);
    const feeFromBps = request.amount * (rule.percentBps / 10_000);
    const fee = roundToCents(rule.flatFee + feeFromBps);
    const totalAmount = roundToCents(request.amount + fee);

    this.logger.info(
      {
        transferType: request.transferType,
        amount: request.amount,
        currency: request.currency,
        fee,
        totalAmount
      },
      'Calculated transfer pricing'
    );

    return {
      fee,
      totalAmount
    };
  }

  async calculateFXPricing(request: FXPricingRequest): Promise<FXPricingResult> {
    const quote = await this.fxRateAdapter.getLatestFxRate(request.baseCurrency, request.quoteCurrency);
    if (!quote) {
      throw new Error('fx_rate_not_found');
    }

    const baseRate = Number(quote.rateValue);
    if (!Number.isFinite(baseRate) || baseRate <= 0) {
      throw new Error('invalid_fx_rate');
    }

    const spreadRule = await this.rulesAdapter.getFxSpreadRules(
      request.baseCurrency,
      request.quoteCurrency,
      request.amount
    );

    const spread = spreadRule.spread;
    const finalRate = roundToScale(baseRate + spread, 8);
    const convertedAmount = roundToScale(request.amount * finalRate, 8);

    this.logger.info(
      {
        baseCurrency: request.baseCurrency,
        quoteCurrency: request.quoteCurrency,
        amount: request.amount,
        baseRate,
        spread,
        finalRate,
        convertedAmount
      },
      'Calculated FX pricing'
    );

    return {
      baseRate,
      spread,
      finalRate,
      convertedAmount
    };
  }
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundToScale(value: number, scale: number): number {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
}
