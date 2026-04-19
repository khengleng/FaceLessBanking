import { randomUUID } from 'node:crypto';

import type { EventEnvelope } from '@faceless-banking/shared-events';

import type {
  CreateRevenueCostRecordInput,
  EntityOwnership,
  RevenueCostAggregate,
  RevenueCostRecord
} from '../domain/profitability.js';

export interface PostgresProfitabilityAdapter {
  createRevenueCostRecord(input: CreateRevenueCostRecordInput): Promise<RevenueCostRecord>;
  hasProcessedEvent(sourceEventId: string): Promise<boolean>;
  markProcessedEvent(sourceEventId: string): Promise<void>;
  listRevenueCostRecords(filters?: { category?: string; relatedEntityId?: string }): Promise<RevenueCostRecord[]>;
  fetchRevenueCostByEntity(entityType: 'CUSTOMER' | 'PRODUCT', entityId: string): Promise<RevenueCostRecord[]>;
  resolveEntityOwnership(relatedEntityId: string): Promise<EntityOwnership | null>;
  aggregateRevenueCost(currency: string): Promise<RevenueCostAggregate>;
}

export interface KafkaProfitabilityAdapter {
  publishProfitabilityRecordCreated(event: EventEnvelope<'profitability.record.created.v1', Record<string, unknown>>): Promise<void>;
}

export interface AlmEngineAdapter {
  getTotalAssets(currency: string): Promise<number>;
  getTotalLiabilities(currency: string): Promise<number>;
}

export class InMemoryPostgresProfitabilityAdapter implements PostgresProfitabilityAdapter {
  private readonly records: RevenueCostRecord[] = [];

  private readonly processedEvents = new Set<string>();

  private readonly ownershipByEntity = new Map<string, EntityOwnership>();

  async createRevenueCostRecord(input: CreateRevenueCostRecordInput): Promise<RevenueCostRecord> {
    const record: RevenueCostRecord = {
      recordId: randomUUID(),
      sourceEventId: input.sourceEventId,
      category: input.category,
      amount: input.amount,
      currency: input.currency,
      relatedEntityId: input.relatedEntityId,
      createdAt: input.createdAt
    };

    this.records.push(record);
    return record;
  }

  async hasProcessedEvent(sourceEventId: string): Promise<boolean> {
    return this.processedEvents.has(sourceEventId);
  }

  async markProcessedEvent(sourceEventId: string): Promise<void> {
    this.processedEvents.add(sourceEventId);
  }

  async listRevenueCostRecords(filters?: { category?: string; relatedEntityId?: string }): Promise<RevenueCostRecord[]> {
    return this.records.filter((record) => {
      if (filters?.category && record.category !== filters.category) {
        return false;
      }

      if (filters?.relatedEntityId && record.relatedEntityId !== filters.relatedEntityId) {
        return false;
      }

      return true;
    });
  }

  async fetchRevenueCostByEntity(entityType: 'CUSTOMER' | 'PRODUCT', entityId: string): Promise<RevenueCostRecord[]> {
    return this.records.filter((record) => {
      const ownership = this.ownershipByEntity.get(record.relatedEntityId);
      if (!ownership) {
        return false;
      }

      if (entityType === 'CUSTOMER') {
        return ownership.customerId === entityId;
      }

      return ownership.productType === entityId;
    });
  }

  async resolveEntityOwnership(relatedEntityId: string): Promise<EntityOwnership | null> {
    return this.ownershipByEntity.get(relatedEntityId) ?? null;
  }

  async aggregateRevenueCost(currency: string): Promise<RevenueCostAggregate> {
    const normalized = currency.toUpperCase();
    const records = this.records.filter((record) => record.currency.toUpperCase() === normalized);

    let interestIncome = 0;
    let feeIncome = 0;
    let fxIncome = 0;
    let totalCost = 0;
    let interestExpense = 0;

    for (const record of records) {
      switch (record.category) {
        case 'INTEREST_INCOME':
          interestIncome += record.amount;
          break;
        case 'FEE_INCOME':
          feeIncome += record.amount;
          break;
        case 'FX_INCOME':
          fxIncome += record.amount;
          break;
        case 'FUNDING_COST':
          totalCost += record.amount;
          interestExpense += record.amount;
          break;
      }
    }

    const calculatedAt =
      records
        .map((record) => record.createdAt)
        .sort()
        .at(-1) ?? '1970-01-01T00:00:00.000Z';

    return {
      interestIncome,
      feeIncome,
      fxIncome,
      totalCost,
      interestExpense,
      currency: normalized,
      calculatedAt
    };
  }

  setEntityOwnership(relatedEntityId: string, ownership: EntityOwnership): void {
    this.ownershipByEntity.set(relatedEntityId, ownership);
  }
}

export class InMemoryKafkaProfitabilityAdapter implements KafkaProfitabilityAdapter {
  public readonly publishedEvents: EventEnvelope<'profitability.record.created.v1', Record<string, unknown>>[] = [];

  async publishProfitabilityRecordCreated(
    event: EventEnvelope<'profitability.record.created.v1', Record<string, unknown>>
  ): Promise<void> {
    this.publishedEvents.push(event);
  }
}

export class InMemoryAlmEngineAdapter implements AlmEngineAdapter {
  private readonly assetsByCurrency = new Map<string, number>([['USD', 1_000_000]]);

  private readonly liabilitiesByCurrency = new Map<string, number>([['USD', 750_000]]);

  async getTotalAssets(currency: string): Promise<number> {
    return this.assetsByCurrency.get(currency.toUpperCase()) ?? 0;
  }

  async getTotalLiabilities(currency: string): Promise<number> {
    return this.liabilitiesByCurrency.get(currency.toUpperCase()) ?? 0;
  }

  setTotals(input: { currency: string; assets: number; liabilities: number }): void {
    const normalized = input.currency.toUpperCase();
    this.assetsByCurrency.set(normalized, input.assets);
    this.liabilitiesByCurrency.set(normalized, input.liabilities);
  }
}
