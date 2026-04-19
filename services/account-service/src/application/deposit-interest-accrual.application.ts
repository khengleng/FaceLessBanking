import { randomUUID } from 'node:crypto';
import type { PostgresAccountAdapter } from '../adapters/postgres-account.adapter.js';
import type { InterestEventsPublisher } from '../events/interest.events.js';
import { calculateDailyInterestCents, type DepositInterestAccrual } from '../domain/interest-accrual.js';

export interface AccrualBatchResult {
  date: string;
  processedCount: number;
  skippedCount: number;
  failureCount: number;
  totalAccruedCents: number;
}

export class DepositInterestAccrualApplication {
  constructor(
    private readonly postgresAdapter: PostgresAccountAdapter,
    private readonly interestEvents: InterestEventsPublisher,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  /**
   * Processes interest accrual for all eligible accounts for a specific date.
   * Typically called by a daily batch job.
   */
  async processDailyAccrual(targetDate?: string): Promise<AccrualBatchResult> {
    const accrualDate = targetDate || new Date().toISOString().split('T')[0];
    const productCode = 'SAVINGS'; // Initial simple assumption
    const defaultAnnualRate = 0.02; // 2% APR placeholder
    
    const eligibleAccounts = await this.postgresAdapter.findAccountsEligibleForInterestAccrual(productCode);
    
    const result: AccrualBatchResult = {
      date: accrualDate,
      processedCount: 0,
      skippedCount: 0,
      failureCount: 0,
      totalAccruedCents: 0
    };

    for (const account of eligibleAccounts) {
      try {
        const alreadyAccrued = await this.postgresAdapter.hasDepositAccrualForAccountAndDate(
          account.accountId,
          accrualDate
        );

        if (alreadyAccrued) {
          result.skippedCount++;
          continue;
        }

        const balanceCents = await this.postgresAdapter.getBalanceSnapshot(account.accountId);
        if (balanceCents <= 0) {
          result.skippedCount++;
          continue;
        }

        const accruedCents = calculateDailyInterestCents(balanceCents, defaultAnnualRate);
        
        const accrual: DepositInterestAccrual = {
          accrualId: randomUUID(),
          accountId: account.accountId,
          accrualDate,
          principalBasisCents: balanceCents,
          annualInterestRate: defaultAnnualRate,
          accruedInterestCents: accruedCents,
          createdAt: new Date().toISOString(),
          status: 'ACCURED'
        };

        await this.postgresAdapter.createDepositInterestAccrual(accrual);
        await this.interestEvents.emitInterestAccrued(accrual);
        
        result.processedCount++;
        result.totalAccruedCents += accruedCents;
      } catch (err: unknown) {
        this.logger.error({ 
          err, 
          accountId: account.accountId, 
          accrualDate 
        }, 'Failed to process interest accrual for account');
        result.failureCount++;
      }
    }

    this.logger.info({ ...result }, 'Completed interest accrual batch');
    return result;
  }
}
