import {
  createEventBackboneProducer,
  type EventBackboneProducer,
  type EventEnvelope
} from '@faceless-banking/shared-events';

import type { Currency, FXRate, FXRateUpdatedPayload } from '../domain/fx.js';

export type CreateFxRateResult = {
  created: boolean;
  rate: FXRate;
};

export interface FXPostgresAdapter {
  createCurrency(currency: Currency): Promise<void>;
  getCurrencyByCode(code: string): Promise<Currency | null>;
  createFxRate(rate: FXRate): Promise<CreateFxRateResult>;
  getLatestFxRate(base: string, quote: string): Promise<FXRate | null>;
  getFxRateHistory(base: string, quote: string): Promise<FXRate[]>;
  hasProcessedRateRequest(requestKey: string): Promise<boolean>;
}

export class InMemoryFXPostgresAdapter implements FXPostgresAdapter {
  private readonly currencies = new Map<string, Currency>();
  private readonly rates: FXRate[] = [];
  private readonly processedRateRequests = new Set<string>();

  async createCurrency(currency: Currency): Promise<void> {
    this.currencies.set(currency.currencyCode, currency);
  }

  async getCurrencyByCode(code: string): Promise<Currency | null> {
    return this.currencies.get(code) ?? null;
  }

  async createFxRate(rate: FXRate): Promise<CreateFxRateResult> {
    const duplicate = this.rates.find((existing) =>
      existing.baseCurrency === rate.baseCurrency
      && existing.quoteCurrency === rate.quoteCurrency
      && existing.effectiveAt === rate.effectiveAt
      && existing.rateValue === rate.rateValue
    );

    if (duplicate) {
      return {
        created: false,
        rate: duplicate
      };
    }

    this.rates.push(rate);
    this.rates.sort((a, b) => {
      const byEffectiveAt = new Date(b.effectiveAt).getTime() - new Date(a.effectiveAt).getTime();
      if (byEffectiveAt !== 0) {
        return byEffectiveAt;
      }

      return b.version - a.version;
    });

    return {
      created: true,
      rate
    };
  }

  async getLatestFxRate(base: string, quote: string): Promise<FXRate | null> {
    const now = Date.now();
    const found = this.rates.find((rate) =>
      rate.baseCurrency === base
      && rate.quoteCurrency === quote
      && new Date(rate.effectiveAt).getTime() <= now
    );

    return found ?? null;
  }

  async getFxRateHistory(base: string, quote: string): Promise<FXRate[]> {
    return this.rates.filter((rate) => rate.baseCurrency === base && rate.quoteCurrency === quote);
  }

  async hasProcessedRateRequest(requestKey: string): Promise<boolean> {
    if (this.processedRateRequests.has(requestKey)) {
      return true;
    }

    this.processedRateRequests.add(requestKey);
    return false;
  }
}

export type FXRateUpdatedEvent = EventEnvelope<'fx.rate.updated.v1', FXRateUpdatedPayload>;

export interface FXKafkaAdapter {
  publishRateUpdated(event: FXRateUpdatedEvent): Promise<{ published: boolean }>;
}

export class InMemoryFXKafkaAdapter implements FXKafkaAdapter {
  private readonly producer: EventBackboneProducer;

  constructor() {
    this.producer = createEventBackboneProducer({
      producer: 'fx-rate-service',
      retry: { maxAttempts: 2 },
      dlq: { topic: 'fx-rate-service.events.dlq', enabled: true }
    });
  }

  get publishedEvents(): Array<EventEnvelope<string, Record<string, unknown>>> {
    return this.producer.publishedEvents;
  }

  async publishRateUpdated(event: FXRateUpdatedEvent): Promise<{ published: boolean }> {
    const result = await this.producer.publish({
      type: event.type,
      version: event.version,
      metadata: {
        eventId: event.metadata.eventId,
        correlationId: event.metadata.correlationId,
        causationId: event.metadata.causationId,
        timestamp: event.metadata.timestamp
      },
      payload: event.payload as unknown as Record<string, unknown>
    });

    return { published: result.published };
  }
}
