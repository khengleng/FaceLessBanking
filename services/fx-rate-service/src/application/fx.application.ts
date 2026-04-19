import crypto from 'node:crypto';

import type { EventEnvelope } from '@faceless-banking/shared-events';

import type { FXPostgresAdapter, FXKafkaAdapter } from '../adapters/fx-adapters.js';
import type { Currency, FXRate, FXRateUpdatedPayload } from '../domain/fx.js';

type Logger = {
  info: (payload: Record<string, unknown>, message: string) => void;
  warn: (payload: Record<string, unknown>, message: string) => void;
  error: (payload: Record<string, unknown>, message: string) => void;
};

export class FXApplication {
  private ratesCreated = 0;
  private duplicateRateSubmissionsSkipped = 0;
  private latestRateLookups = 0;

  constructor(
    private readonly postgres: FXPostgresAdapter,
    private readonly kafka: FXKafkaAdapter,
    private readonly logger: Logger
  ) {}

  async createCurrency(params: {
    currencyCode: string;
    currencyName: string;
    decimalPlaces: number;
  }): Promise<Currency> {
    const code = params.currencyCode.toUpperCase();

    const existing = await this.postgres.getCurrencyByCode(code);
    if (existing) {
      throw new Error('currency_exists');
    }

    const now = new Date().toISOString();
    const currency: Currency = {
      currencyCode: code,
      currencyName: params.currencyName,
      decimalPlaces: params.decimalPlaces,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };

    await this.postgres.createCurrency(currency);
    this.logger.info({ currencyCode: code }, 'Created currency definition');

    return currency;
  }

  async getCurrencyByCode(currencyCode: string): Promise<Currency | null> {
    return this.postgres.getCurrencyByCode(currencyCode.toUpperCase());
  }

  async submitFxRate(params: {
    baseCurrency: string;
    quoteCurrency: string;
    rateValue: string;
    effectiveAt: string;
    correlationId?: string;
  }): Promise<FXRate> {
    const baseCurrency = params.baseCurrency.toUpperCase();
    const quoteCurrency = params.quoteCurrency.toUpperCase();

    if (baseCurrency === quoteCurrency) {
      throw new Error('invalid_currency_pair');
    }

    const [base, quote] = await Promise.all([
      this.postgres.getCurrencyByCode(baseCurrency),
      this.postgres.getCurrencyByCode(quoteCurrency)
    ]);

    if (!base || !quote) {
      throw new Error('currency_not_found');
    }

    const duplicateRequestKey = `${baseCurrency}:${quoteCurrency}:${params.effectiveAt}:${params.rateValue}`;
    const requestAlreadyProcessed = await this.postgres.hasProcessedRateRequest(duplicateRequestKey);
    if (requestAlreadyProcessed) {
      const existing = await this.findMatchingRate(baseCurrency, quoteCurrency, params.effectiveAt, params.rateValue);
      if (existing) {
        this.duplicateRateSubmissionsSkipped += 1;
        this.logger.warn(
          { baseCurrency, quoteCurrency, effectiveAt: params.effectiveAt },
          'Skipping duplicate FX rate submission'
        );
        return existing;
      }
    }

    const latest = await this.postgres.getLatestFxRate(baseCurrency, quoteCurrency);
    const nextVersion = (latest?.version ?? 0) + 1;

    const rate: FXRate = {
      rateId: crypto.randomUUID(),
      baseCurrency,
      quoteCurrency,
      rateType: 'SPOT',
      rateValue: params.rateValue,
      effectiveAt: params.effectiveAt,
      version: nextVersion,
      createdAt: new Date().toISOString()
    };

    const createResult = await this.postgres.createFxRate(rate);
    if (!createResult.created) {
      this.duplicateRateSubmissionsSkipped += 1;
      this.logger.warn(
        {
          baseCurrency,
          quoteCurrency,
          effectiveAt: params.effectiveAt,
          rateValue: params.rateValue
        },
        'Skipping duplicate FX rate submission'
      );
      return createResult.rate;
    }

    const event: EventEnvelope<'fx.rate.updated.v1', FXRateUpdatedPayload> = {
      specVersion: '1.0',
      type: 'fx.rate.updated.v1',
      version: 1,
      metadata: {
        eventId: crypto.randomUUID(),
        correlationId: params.correlationId ?? `fx-rate-${rate.rateId}`,
        causationId: `fx-rate-create-${rate.rateId}`,
        timestamp: new Date().toISOString(),
        producer: 'fx-rate-service'
      },
      payload: {
        rateId: rate.rateId,
        baseCurrency: rate.baseCurrency,
        quoteCurrency: rate.quoteCurrency,
        rateType: rate.rateType,
        rateValue: rate.rateValue,
        effectiveAt: rate.effectiveAt
      }
    };

    await this.kafka.publishRateUpdated(event);
    this.ratesCreated += 1;

    this.logger.info(
      {
        rateId: rate.rateId,
        baseCurrency,
        quoteCurrency,
        version: rate.version,
        effectiveAt: rate.effectiveAt
      },
      'Created FX rate and emitted update event'
    );

    return rate;
  }

  async getLatestFxRate(baseCurrency: string, quoteCurrency: string): Promise<FXRate | null> {
    this.latestRateLookups += 1;

    return this.postgres.getLatestFxRate(baseCurrency.toUpperCase(), quoteCurrency.toUpperCase());
  }

  async getFxRateHistory(baseCurrency: string, quoteCurrency: string): Promise<FXRate[]> {
    return this.postgres.getFxRateHistory(baseCurrency.toUpperCase(), quoteCurrency.toUpperCase());
  }

  getMetrics(): {
    ratesCreated: number;
    duplicateRateSubmissionsSkipped: number;
    latestRateLookups: number;
  } {
    return {
      ratesCreated: this.ratesCreated,
      duplicateRateSubmissionsSkipped: this.duplicateRateSubmissionsSkipped,
      latestRateLookups: this.latestRateLookups
    };
  }

  private async findMatchingRate(
    baseCurrency: string,
    quoteCurrency: string,
    effectiveAt: string,
    rateValue: string
  ): Promise<FXRate | null> {
    const history = await this.postgres.getFxRateHistory(baseCurrency, quoteCurrency);
    return history.find((rate) => rate.effectiveAt === effectiveAt && rate.rateValue === rateValue) ?? null;
  }
}
