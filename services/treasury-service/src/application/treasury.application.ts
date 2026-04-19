import { randomUUID } from 'node:crypto';
import type { TreasuryAccount, TreasuryTransfer } from '../domain/treasury.js';
import type { PostgresTreasuryAdapter } from '../adapters/postgres-treasury.adapter.js';
import type { PaymentOrchestrationAdapter } from '../adapters/payment-orchestration.adapter.js';

export class TreasuryApplication {
  constructor(
    private readonly postgresAdapter: PostgresTreasuryAdapter,
    private readonly paymentAdapter: PaymentOrchestrationAdapter,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async getAccounts(): Promise<TreasuryAccount[]> {
    return this.postgresAdapter.listAccounts();
  }

  async initiateRebalance(params: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountCents: bigint;
    currency: string;
    purpose: string;
  }): Promise<TreasuryTransfer> {
    const source = await this.postgresAdapter.getAccountById(params.sourceAccountId);
    const dest = await this.postgresAdapter.getAccountById(params.destinationAccountId);

    if (!source || !dest) {
      throw new Error('Source or Destination treasury account not found');
    }

    if (source.currency !== params.currency || dest.currency !== params.currency) {
      throw new Error('Currency mismatch between accounts and transfer');
    }

    const transfer: TreasuryTransfer = {
      transferId: randomUUID(),
      sourceAccountId: params.sourceAccountId,
      destinationAccountId: params.destinationAccountId,
      amountCents: params.amountCents,
      currency: params.currency,
      purpose: params.purpose,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.postgresAdapter.createTransfer(transfer);

    try {
      const result = await this.paymentAdapter.initiateTransfer({
        sourceAccountId: params.sourceAccountId,
        destinationAccountId: params.destinationAccountId,
        amountCents: params.amountCents,
        currency: params.currency,
        idempotencyKey: transfer.transferId,
        purpose: 'TREASURY_REBALANCE',
        metadata: {
          treasuryTransferId: transfer.transferId,
          reason: params.purpose
        }
      });

      await this.postgresAdapter.updateTransferStatus(transfer.transferId, 'COMPLETED');
      this.logger.info({ transferId: transfer.transferId, paymentId: result.paymentId }, 'Treasury rebalance initiated successfully');
      
      const updated = await this.postgresAdapter.getTransferById(transfer.transferId);
      return updated!;
    } catch (err) {
      this.logger.error({ err, transferId: transfer.transferId }, 'Treasury rebalance failed');
      await this.postgresAdapter.updateTransferStatus(transfer.transferId, 'FAILED');
      throw err;
    }
  }

  async createAccount(account: TreasuryAccount): Promise<void> {
    await this.postgresAdapter.createAccount(account);
  }
}
