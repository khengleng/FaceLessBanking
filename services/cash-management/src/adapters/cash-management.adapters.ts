import crypto from 'node:crypto';

import type { EventEnvelope } from '@faceless-banking/shared-events';

import type {
  BulkPaymentBatch,
  BulkPaymentItem,
  CorporateCashPosition,
  CreateBulkPaymentInput,
  CreateVirtualAccountInput,
  VirtualAccount
} from '../domain/cash-management.js';

export interface CashManagementPostgresAdapter {
  createVirtualAccount(input: CreateVirtualAccountInput): Promise<VirtualAccount>;
  createBulkPaymentBatch(input: CreateBulkPaymentInput): Promise<BulkPaymentBatch>;
  getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ id: string } | null>;
  setIdempotencyResult(scope: string, idempotencyKey: string, result: { id: string }): Promise<void>;
  listPositions(corporateId?: string): Promise<CorporateCashPosition[]>;
}

export interface CashManagementEventAdapter {
  publish(event: EventEnvelope<string, Record<string, unknown>>): Promise<void>;
}

export class InMemoryCashManagementPostgresAdapter implements CashManagementPostgresAdapter {
  private readonly virtualAccounts = new Map<string, VirtualAccount>();

  private readonly bulkBatches = new Map<string, BulkPaymentBatch>();

  private readonly idempotency = new Map<string, { id: string }>();

  async createVirtualAccount(input: CreateVirtualAccountInput): Promise<VirtualAccount> {
    const now = new Date().toISOString();
    const virtualAccount: VirtualAccount = {
      virtualAccountId: crypto.randomUUID(),
      corporateId: input.corporateId,
      accountNumber: `VA-${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, '0')}`,
      mappedAccountId: input.mappedAccountId,
      currency: input.currency,
      createdAt: now
    };

    this.virtualAccounts.set(virtualAccount.virtualAccountId, virtualAccount);
    return virtualAccount;
  }

  async createBulkPaymentBatch(input: CreateBulkPaymentInput): Promise<BulkPaymentBatch> {
    const now = new Date().toISOString();
    const items: BulkPaymentItem[] = input.items.map((item) => ({
      paymentItemId: crypto.randomUUID(),
      sourceAccountId: item.sourceAccountId,
      destinationAccountId: item.destinationAccountId,
      amount: item.amount,
      currency: input.currency,
      status: 'PROCESSED'
    }));

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    const batch: BulkPaymentBatch = {
      batchId: crypto.randomUUID(),
      corporateId: input.corporateId,
      items,
      totalAmount,
      currency: input.currency,
      status: 'PROCESSED',
      createdAt: now
    };

    this.bulkBatches.set(batch.batchId, batch);
    return batch;
  }

  async getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ id: string } | null> {
    return this.idempotency.get(`${scope}:${idempotencyKey}`) ?? null;
  }

  async setIdempotencyResult(scope: string, idempotencyKey: string, result: { id: string }): Promise<void> {
    this.idempotency.set(`${scope}:${idempotencyKey}`, result);
  }

  async listPositions(corporateId?: string): Promise<CorporateCashPosition[]> {
    const corpIds = new Set<string>();
    for (const va of this.virtualAccounts.values()) {
      corpIds.add(va.corporateId);
    }
    for (const batch of this.bulkBatches.values()) {
      corpIds.add(batch.corporateId);
    }

    const positions: CorporateCashPosition[] = [];

    for (const corpId of corpIds) {
      if (corporateId && corpId !== corporateId) {
        continue;
      }

      const corpVirtualAccounts = [...this.virtualAccounts.values()].filter((va) => va.corporateId === corpId);
      const corpBatches = [...this.bulkBatches.values()].filter((batch) => batch.corporateId === corpId);

      const groupedByCurrency = new Map<string, { vaCount: number; totalAmount: number }>();

      for (const va of corpVirtualAccounts) {
        const current = groupedByCurrency.get(va.currency) ?? { vaCount: 0, totalAmount: 0 };
        current.vaCount += 1;
        groupedByCurrency.set(va.currency, current);
      }

      for (const batch of corpBatches) {
        const current = groupedByCurrency.get(batch.currency) ?? { vaCount: 0, totalAmount: 0 };
        current.totalAmount += batch.totalAmount;
        groupedByCurrency.set(batch.currency, current);
      }

      for (const [currency, totals] of groupedByCurrency.entries()) {
        positions.push({
          corporateId: corpId,
          currency,
          virtualAccountCount: totals.vaCount,
          totalProcessedBulkAmount: totals.totalAmount,
          updatedAt: new Date().toISOString()
        });
      }
    }

    return positions;
  }

  getVirtualAccountById(id: string): VirtualAccount | null {
    return this.virtualAccounts.get(id) ?? null;
  }

  getBulkBatchById(id: string): BulkPaymentBatch | null {
    return this.bulkBatches.get(id) ?? null;
  }
}

export class InMemoryCashManagementEventAdapter implements CashManagementEventAdapter {
  readonly events: EventEnvelope<string, Record<string, unknown>>[] = [];

  async publish(event: EventEnvelope<string, Record<string, unknown>>): Promise<void> {
    this.events.push(event);
  }
}
