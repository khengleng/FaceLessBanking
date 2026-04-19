import { randomUUID } from 'node:crypto';

import { buildEventEnvelope } from '@faceless-banking/shared-events';

import type {
  BankPnL,
  CreateRevenueCostRecordInput,
  FinancialEventEnvelope,
  MarginMetrics,
  ProfitabilityView,
  RevenueCostRecord,
  SupportedFinancialEventType
} from '../domain/profitability.js';
import type {
  AlmEngineAdapter,
  KafkaProfitabilityAdapter,
  PostgresProfitabilityAdapter
} from '../adapters/profitability-adapters.js';

interface Logger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

const SUPPORTED_EVENT_TYPES: ReadonlySet<SupportedFinancialEventType> = new Set([
  'loan.interest.accrued.v1',
  'fee.collected.v1',
  'payment.status.updated.v1',
  'fx.rate.applied'
]);

export class ProfitabilityApplication {
  constructor(
    private readonly postgresAdapter: PostgresProfitabilityAdapter,
    private readonly kafkaAdapter: KafkaProfitabilityAdapter,
    private readonly almAdapter: AlmEngineAdapter,
    private readonly logger: Logger
  ) {}

  async processFinancialEvent(event: FinancialEventEnvelope): Promise<{ processed: boolean; record?: RevenueCostRecord }> {
    if (!this.isValidEnvelope(event)) {
      this.logger.warn({ eventType: event.type }, 'Malformed profitability source event rejected');
      return { processed: false };
    }

    const sourceEventId = event.metadata.eventId;
    const correlationId = event.metadata.correlationId;

    if (await this.postgresAdapter.hasProcessedEvent(sourceEventId)) {
      this.logger.info({ sourceEventId }, 'Duplicate profitability source event skipped');
      return { processed: false };
    }

    const mapping = this.mapEventToRecord(event);

    await this.postgresAdapter.markProcessedEvent(sourceEventId);

    if (!mapping) {
      this.logger.info({ sourceEventId, type: event.type }, 'Event does not produce profitability attribution in current rules');
      return { processed: false };
    }

    const record = await this.postgresAdapter.createRevenueCostRecord({
      sourceEventId,
      category: mapping.category,
      amount: mapping.amount,
      currency: mapping.currency,
      relatedEntityId: mapping.relatedEntityId,
      createdAt: event.metadata.timestamp
    });

    const createdEvent = buildEventEnvelope({
      type: 'profitability.record.created.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId,
        causationId: sourceEventId,
        timestamp: new Date().toISOString(),
        producer: 'profitability-engine'
      },
      payload: {
        recordId: record.recordId,
        sourceEventId: record.sourceEventId,
        category: record.category,
        amount: record.amount,
        currency: record.currency,
        relatedEntityId: record.relatedEntityId,
        createdAt: record.createdAt
      }
    });

    await this.kafkaAdapter.publishProfitabilityRecordCreated(createdEvent);

    this.logger.info(
      {
        sourceEventId,
        recordId: record.recordId,
        category: record.category,
        correlationId
      },
      'Profitability attribution record created'
    );

    return { processed: true, record };
  }

  async listRecords(filters?: { category?: string; relatedEntityId?: string }): Promise<RevenueCostRecord[]> {
    return this.postgresAdapter.listRevenueCostRecords(filters);
  }

  async getCustomerProfitability(customerId: string): Promise<ProfitabilityView> {
    const records = await this.postgresAdapter.fetchRevenueCostByEntity('CUSTOMER', customerId);
    return this.buildProfitabilityView(customerId, records);
  }

  async getProductProfitability(productType: string): Promise<ProfitabilityView> {
    const records = await this.postgresAdapter.fetchRevenueCostByEntity('PRODUCT', productType);
    return this.buildProfitabilityView(productType, records);
  }

  async getBankPnL(currency: string): Promise<BankPnL> {
    const aggregate = await this.postgresAdapter.aggregateRevenueCost(currency);
    const totalIncome = aggregate.interestIncome + aggregate.feeIncome + aggregate.fxIncome;

    return {
      totalInterestIncome: roundToScale(aggregate.interestIncome, 6),
      totalFeeIncome: roundToScale(aggregate.feeIncome, 6),
      totalFxIncome: roundToScale(aggregate.fxIncome, 6),
      totalCost: roundToScale(aggregate.totalCost, 6),
      netProfit: roundToScale(totalIncome - aggregate.totalCost, 6),
      currency: aggregate.currency,
      calculatedAt: aggregate.calculatedAt
    };
  }

  async getMarginMetrics(currency: string): Promise<MarginMetrics> {
    const [aggregate, totalAssets, totalLiabilities] = await Promise.all([
      this.postgresAdapter.aggregateRevenueCost(currency),
      this.almAdapter.getTotalAssets(currency),
      this.almAdapter.getTotalLiabilities(currency)
    ]);

    const nim = safeDivide(aggregate.interestIncome, totalAssets);
    const costOfFunds = safeDivide(aggregate.interestExpense, totalLiabilities);
    const yieldOnAssets = safeDivide(aggregate.interestIncome, totalAssets);

    return {
      netInterestMargin: nim,
      costOfFunds,
      yieldOnAssets
    };
  }

  private isValidEnvelope(event: FinancialEventEnvelope): boolean {
    if (event.specVersion !== '1.0') {
      return false;
    }

    if (!SUPPORTED_EVENT_TYPES.has(event.type as SupportedFinancialEventType)) {
      return false;
    }

    if (!event.metadata?.eventId || !event.metadata?.correlationId || !event.metadata?.timestamp) {
      return false;
    }

    if (!event.payload || typeof event.payload !== 'object') {
      return false;
    }

    return true;
  }

  private mapEventToRecord(event: FinancialEventEnvelope): CreateRevenueCostRecordInput | null {
    switch (event.type as SupportedFinancialEventType) {
      case 'loan.interest.accrued.v1':
        return this.mapLoanInterestAccrued(event.payload, event.metadata.eventId, event.metadata.timestamp);
      case 'fee.collected.v1':
        return this.mapFeeCollected(event.payload, event.metadata.eventId, event.metadata.timestamp);
      case 'payment.status.updated.v1':
        return this.mapPaymentStatusUpdated(event.payload, event.metadata.eventId, event.metadata.timestamp);
      case 'fx.rate.applied':
        return this.mapFxApplied(event.payload, event.metadata.eventId, event.metadata.timestamp);
      default:
        return null;
    }
  }

  private mapLoanInterestAccrued(
    payload: Record<string, unknown>,
    sourceEventId: string,
    createdAt: string
  ): CreateRevenueCostRecordInput {
    return {
      sourceEventId,
      category: 'INTEREST_INCOME',
      amount: this.readNumber(payload.accruedInterest),
      currency: this.readCurrency(payload.currency),
      relatedEntityId: this.readString(payload.loanAccountId, 'UNKNOWN_LOAN'),
      createdAt
    };
  }

  private mapFeeCollected(
    payload: Record<string, unknown>,
    sourceEventId: string,
    createdAt: string
  ): CreateRevenueCostRecordInput {
    const feeAmount = this.readNumber(payload.assessedAmountCents ?? payload.amount ?? payload.amountCents);

    return {
      sourceEventId,
      category: 'FEE_INCOME',
      amount: feeAmount,
      currency: this.readCurrency(payload.currency),
      relatedEntityId: this.readString(payload.paymentId ?? payload.assessmentId, 'UNKNOWN_FEE_ENTITY'),
      createdAt
    };
  }

  private mapPaymentStatusUpdated(
    payload: Record<string, unknown>,
    sourceEventId: string,
    createdAt: string
  ): CreateRevenueCostRecordInput | null {
    const status = this.readString(payload.status, 'UNKNOWN');
    if (status !== 'COMPLETED') {
      return null;
    }

    const amount = this.readNumber(payload.amount ?? payload.amountCents);
    const fundingCost = roundToScale(amount * 0.001, 6);

    return {
      sourceEventId,
      category: 'FUNDING_COST',
      amount: fundingCost,
      currency: this.readCurrency(payload.currency),
      relatedEntityId: this.readString(payload.paymentId, 'UNKNOWN_PAYMENT'),
      createdAt
    };
  }

  private mapFxApplied(
    payload: Record<string, unknown>,
    sourceEventId: string,
    createdAt: string
  ): CreateRevenueCostRecordInput {
    const fxIncome = this.readNumber(payload.spreadAmount ?? payload.fxIncomeAmount ?? payload.amount ?? 0);

    return {
      sourceEventId,
      category: 'FX_INCOME',
      amount: fxIncome,
      currency: this.readCurrency(payload.currency),
      relatedEntityId: this.readString(payload.paymentId ?? payload.rateId, 'UNKNOWN_FX_ENTITY'),
      createdAt
    };
  }

  private readNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return 0;
  }

  private readCurrency(value: unknown): string {
    const raw = this.readString(value, 'USD').trim().toUpperCase();
    return raw.length === 3 ? raw : 'USD';
  }

  private readString(value: unknown, fallback: string): string {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }

    return fallback;
  }

  private buildProfitabilityView(entityId: string, records: RevenueCostRecord[]): ProfitabilityView {
    let totalRevenue = 0;
    let totalCost = 0;

    for (const record of records) {
      if (record.category === 'FUNDING_COST') {
        totalCost += record.amount;
      } else {
        totalRevenue += record.amount;
      }
    }

    return {
      entityId,
      totalRevenue: roundToScale(totalRevenue, 6),
      totalCost: roundToScale(totalCost, 6),
      netProfit: roundToScale(totalRevenue - totalCost, 6),
      currency: records[0]?.currency ?? 'USD'
    };
  }
}

function roundToScale(value: number, scale: number): number {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
}

export type ProfitabilityApp = ProfitabilityApplication;

function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return roundToScale(numerator / denominator, 6);
}
