import type { Account } from '../domain/account.js';
import type { DepositInterestAccrual } from '../domain/interest-accrual.js';

export class PostgresAccountAdapter {
  private readonly accounts = new Map<string, Account>();
  private readonly accountIdByCustomerId = new Map<string, string>();
  private readonly processedAccountCreationEvents = new Set<string>();
  private readonly processedActivationEvents = new Set<string>();
  private readonly depositAccruals = new Map<string, DepositInterestAccrual>();

  async insertAccount(account: Account): Promise<void> {
    this.accounts.set(account.accountId, account);
    this.accountIdByCustomerId.set(account.customerId, account.accountId);
  }

  async findAccountById(accountId: string): Promise<Account | null> {
    return this.accounts.get(accountId) ?? null;
  }

  async getAccountById(accountId: string): Promise<Account | null> {
    return this.findAccountById(accountId);
  }

  async createAccount(account: Account): Promise<void> {
    await this.insertAccount(account);
  }

  async findAccountByCustomerId(customerId: string): Promise<Account | null> {
    const accountId = this.accountIdByCustomerId.get(customerId);
    if (!accountId) {
      return null;
    }

    return this.accounts.get(accountId) ?? null;
  }

  async listAccounts(input: {
    customerId?: string;
    accountId?: string;
    onboardingReference?: string;
    limit: number;
    offset: number;
  }): Promise<Account[]> {
    const accounts = Array.from(this.accounts.values())
      .filter((record) => (input.customerId ? record.customerId === input.customerId : true))
      .filter((record) => (input.accountId ? record.accountId === input.accountId : true))
      .filter((record) => (input.onboardingReference ? record.onboardingReference === input.onboardingReference : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return accounts.slice(input.offset, input.offset + input.limit);
  }

  async hasProcessedAccountCreationEvent(sourceEventId: string): Promise<boolean> {
    return this.processedAccountCreationEvents.has(sourceEventId);
  }

  async markAccountCreationEventProcessed(sourceEventId: string): Promise<void> {
    this.processedAccountCreationEvents.add(sourceEventId);
  }

  async updateAccountStatus(accountId: string, status: Account['status']): Promise<void> {
    const current = this.accounts.get(accountId);
    if (!current) {
      return;
    }

    this.accounts.set(accountId, {
      ...current,
      status,
      updatedAt: new Date().toISOString()
    });
  }

  async hasProcessedActivationEvent(sourceEventId: string): Promise<boolean> {
    return this.processedActivationEvents.has(sourceEventId);
  }

  async markActivationEventProcessed(sourceEventId: string): Promise<void> {
    this.processedActivationEvents.add(sourceEventId);
  }

  async findAccountsEligibleForInterestAccrual(productCode: string): Promise<Account[]> {
    return Array.from(this.accounts.values()).filter(
      (a) => a.status === 'ACTIVE' && a.productCode === productCode
    );
  }

  async getBalanceSnapshot(accountId: string): Promise<number> {
    const account = this.accounts.get(accountId);
    // In a real system, this would join with a balance table or call balance-service.
    // For now, use the account's currently tracked available balance.
    return account?.availableBalanceCents ?? 0;
  }

  async hasDepositAccrualForAccountAndDate(accountId: string, accrualDate: string): Promise<boolean> {
    const key = `${accountId}:${accrualDate}`;
    return this.depositAccruals.has(key);
  }

  async createDepositInterestAccrual(accrual: DepositInterestAccrual): Promise<void> {
    const key = `${accrual.accountId}:${accrual.accrualDate}`;
    this.depositAccruals.set(key, accrual);
  }
}
