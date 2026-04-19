import crypto from 'node:crypto';

import { buildEventEnvelope } from '@faceless-banking/shared-events';

import type {
  CashManagementEventAdapter,
  CashManagementPostgresAdapter,
  InMemoryCashManagementPostgresAdapter
} from '../adapters/cash-management.adapters.js';
import type {
  BulkPaymentBatch,
  CorporateCashPosition,
  CreateBulkPaymentInput,
  CreateVirtualAccountInput,
  VirtualAccount
} from '../domain/cash-management.js';

type Logger = {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

export class CashManagementApplication {
  constructor(
    private readonly postgres: CashManagementPostgresAdapter,
    private readonly events: CashManagementEventAdapter,
    private readonly logger: Logger
  ) {}

  async createVirtualAccount(input: {
    request: CreateVirtualAccountInput;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<VirtualAccount> {
    const existing = await this.postgres.getIdempotencyResult('virtual-account-create', input.idempotencyKey);
    if (existing && this.isInMemoryAdapter(this.postgres)) {
      const prior = this.postgres.getVirtualAccountById(existing.id);
      if (prior) {
        this.logger.info({ virtualAccountId: prior.virtualAccountId }, 'Returning idempotent virtual account create result');
        return prior;
      }
    }

    const virtualAccount = await this.postgres.createVirtualAccount(input.request);
    await this.postgres.setIdempotencyResult('virtual-account-create', input.idempotencyKey, { id: virtualAccount.virtualAccountId });

    await this.events.publish(
      buildEventEnvelope({
        type: 'cash.virtual_account.created.v1',
        version: 1,
        metadata: {
          eventId: crypto.randomUUID(),
          correlationId: input.correlationId,
          causationId: input.idempotencyKey,
          timestamp: new Date().toISOString(),
          producer: 'cash-management'
        },
        payload: {
          virtualAccountId: virtualAccount.virtualAccountId,
          corporateId: virtualAccount.corporateId,
          mappedAccountId: virtualAccount.mappedAccountId,
          currency: virtualAccount.currency
        }
      })
    );

    return virtualAccount;
  }

  async processBulkPayments(input: {
    request: CreateBulkPaymentInput;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<BulkPaymentBatch> {
    const existing = await this.postgres.getIdempotencyResult('bulk-payment-create', input.idempotencyKey);
    if (existing && this.isInMemoryAdapter(this.postgres)) {
      const prior = this.postgres.getBulkBatchById(existing.id);
      if (prior) {
        this.logger.info({ batchId: prior.batchId }, 'Returning idempotent bulk payment result');
        return prior;
      }
    }

    const batch = await this.postgres.createBulkPaymentBatch(input.request);
    await this.postgres.setIdempotencyResult('bulk-payment-create', input.idempotencyKey, { id: batch.batchId });

    await this.events.publish(
      buildEventEnvelope({
        type: 'cash.bulk_payments.processed.v1',
        version: 1,
        metadata: {
          eventId: crypto.randomUUID(),
          correlationId: input.correlationId,
          causationId: input.idempotencyKey,
          timestamp: new Date().toISOString(),
          producer: 'cash-management'
        },
        payload: {
          batchId: batch.batchId,
          corporateId: batch.corporateId,
          currency: batch.currency,
          itemCount: batch.items.length,
          totalAmount: batch.totalAmount,
          status: batch.status
        }
      })
    );

    return batch;
  }

  async getPositions(corporateId?: string): Promise<CorporateCashPosition[]> {
    return this.postgres.listPositions(corporateId);
  }

  private isInMemoryAdapter(adapter: CashManagementPostgresAdapter): adapter is InMemoryCashManagementPostgresAdapter {
    return 'getVirtualAccountById' in adapter && 'getBulkBatchById' in adapter;
  }
}
