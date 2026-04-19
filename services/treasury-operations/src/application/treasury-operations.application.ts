import { randomUUID } from 'node:crypto';
import type { TreasuryAccount, TreasuryTransfer } from '../domain/treasury.js';
import type { PostgresTreasuryAdapter } from '../adapters/postgres-treasury.adapter.js';
import type { PaymentOrchestrationAdapter } from '../adapters/payment-orchestration.adapter.js';
import type { TreasuryEventsPublisher } from '../events/treasury-publisher.js';

export class TreasuryOperationsApplication {
  constructor(
    private readonly postgresAdapter: PostgresTreasuryAdapter,
    private readonly paymentAdapter: PaymentOrchestrationAdapter,
    private readonly eventPublisher: TreasuryEventsPublisher,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async getAccounts(): Promise<TreasuryAccount[]> {
    return this.postgresAdapter.listAccounts();
  }

  async getTransfer(transferId: string): Promise<TreasuryTransfer | null> {
    return this.postgresAdapter.getTransferById(transferId);
  }

  async initiateTransfer(params: {
    fromAccount: string;
    toAccount: string;
    amountCents: bigint;
    currency: string;
    idempotencyKey?: string;
  }): Promise<TreasuryTransfer> {
    const transferId = params.idempotencyKey || randomUUID();
    
    // Idempotency check
    const existing = await this.postgresAdapter.getTransferById(transferId);
    if (existing) {
      this.logger.info({ transferId }, 'Duplicate treasury transfer request skipped');
      return existing;
    }

    const from = await this.postgresAdapter.getTreasuryAccount(params.fromAccount);
    const to = await this.postgresAdapter.getTreasuryAccount(params.toAccount);

    if (!from || !to) {
      throw new Error('Treasury account not found');
    }

    if (from.currency !== params.currency || to.currency !== params.currency) {
      throw new Error('Currency mismatch');
    }

    // Rule: Check liquidity (sufficient balance in source treasury account)
    if (from.balanceCents < params.amountCents) {
      throw new Error('Insufficient liquidity in source treasury account');
    }

    const transfer: TreasuryTransfer = {
      transferId,
      fromAccount: params.fromAccount,
      toAccount: params.toAccount,
      amountCents: params.amountCents,
      currency: params.currency,
      status: 'INITIATED',
      createdAt: new Date().toISOString()
    };

    await this.postgresAdapter.createTreasuryTransfer(transfer);

    try {
      await this.paymentAdapter.initiateInternalTransfer({
        sourceAccountId: params.fromAccount,
        destinationAccountId: params.toAccount,
        amountCents: params.amountCents,
        currency: params.currency,
        idempotencyKey: transferId,
        metadata: { treasuryTransferId: transferId }
      });

      await this.eventPublisher.emitTransferInitiated(transfer);
      this.logger.info({ transferId }, 'Treasury transfer initiated successfully');
      
      return transfer;
    } catch (err) {
      this.logger.error({ err, transferId }, 'Failed to initiate treasury transfer payment');
      throw err;
    }
  }

  async createAccount(account: TreasuryAccount): Promise<void> {
    await this.postgresAdapter.saveTreasuryAccount(account);
  }
}
