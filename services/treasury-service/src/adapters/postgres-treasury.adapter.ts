import type { TreasuryAccount, TreasuryTransfer } from '../domain/treasury.js';

export class PostgresTreasuryAdapter {
  private readonly accounts = new Map<string, TreasuryAccount>();
  private readonly transfers = new Map<string, TreasuryTransfer>();

  async getAccountById(accountId: string): Promise<TreasuryAccount | null> {
    return this.accounts.get(accountId) ?? null;
  }

  async listAccounts(): Promise<TreasuryAccount[]> {
    return Array.from(this.accounts.values());
  }

  async createAccount(account: TreasuryAccount): Promise<void> {
    this.accounts.set(account.accountId, account);
  }

  async createTransfer(transfer: TreasuryTransfer): Promise<void> {
    this.transfers.set(transfer.transferId, transfer);
  }

  async updateTransferStatus(transferId: string, status: TreasuryTransfer['status']): Promise<void> {
    const t = this.transfers.get(transferId);
    if (t) {
      this.transfers.set(transferId, { ...t, status, updatedAt: new Date().toISOString() });
    }
  }

  async getTransferById(transferId: string): Promise<TreasuryTransfer | null> {
    return this.transfers.get(transferId) ?? null;
  }
}
