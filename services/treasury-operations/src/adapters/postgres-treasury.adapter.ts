import type { TreasuryAccount, TreasuryTransfer } from '../domain/treasury.js';

export class PostgresTreasuryAdapter {
  private readonly accounts = new Map<string, TreasuryAccount>();
  private readonly transfers = new Map<string, TreasuryTransfer>();

  async getTreasuryAccount(accountId: string): Promise<TreasuryAccount | null> {
    return this.accounts.get(accountId) ?? null;
  }

  async saveTreasuryAccount(account: TreasuryAccount): Promise<void> {
    this.accounts.set(account.accountId, account);
  }

  async createTreasuryTransfer(transfer: TreasuryTransfer): Promise<void> {
    this.transfers.set(transfer.transferId, transfer);
  }

  async getTransferById(transferId: string): Promise<TreasuryTransfer | null> {
    return this.transfers.get(transferId) ?? null;
  }

  async listAccounts(): Promise<TreasuryAccount[]> {
    return Array.from(this.accounts.values());
  }
}
