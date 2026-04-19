import { test, describe } from 'node:test';
import assert from 'node:assert';
import { calculateDailyInterestCents } from '../domain/interest-accrual.js';
import { DepositInterestAccrualApplication } from '../application/deposit-interest-accrual.application.js';
import type { PostgresAccountAdapter } from '../adapters/postgres-account.adapter.js';
import type { InterestEventsPublisher } from '../events/interest.events.js';

type AccountAdapterPort = Pick<
  PostgresAccountAdapter,
  | 'findAccountsEligibleForInterestAccrual'
  | 'getBalanceSnapshot'
  | 'hasDepositAccrualForAccountAndDate'
  | 'createDepositInterestAccrual'
>;

type InterestEventsPort = Pick<InterestEventsPublisher, 'emitInterestAccrued'>;

type InterestLogger = {
  info: (payload: Record<string, unknown>, message: string) => void;
  warn: (payload: Record<string, unknown>, message: string) => void;
  error: (payload: Record<string, unknown>, message: string) => void;
};

// Mocks
const mockPostgresAdapter = {
  findAccountsEligibleForInterestAccrual: async () => [],
  getBalanceSnapshot: async () => 0,
  hasDepositAccrualForAccountAndDate: async () => false,
  createDepositInterestAccrual: async () => {}
} satisfies AccountAdapterPort;

const mockInterestEvents = {
  emitInterestAccrued: async () => {}
} satisfies InterestEventsPort;

const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {}
} satisfies InterestLogger;

describe('Interest Accrual Logic', () => {
  test('calculateDailyInterestCents correctly handles precision', () => {
    // 1000.00 USD (100000 cents) at 2% APR
    // (100000 * 0.02) / 365 = 2000 / 365 = 5.479...
    // Round to 5 cents
    const interest = calculateDailyInterestCents(100000, 0.02);
    assert.strictEqual(interest, 5);
  });

  test('calculateDailyInterestCents handles zero balance', () => {
    const interest = calculateDailyInterestCents(0, 0.02);
    assert.strictEqual(interest, 0);
  });
});

describe('DepositInterestAccrualApplication', () => {
  test('processDailyAccrual skips already accrued accounts', async () => {
    const testAdapter = {
      ...mockPostgresAdapter,
      findAccountsEligibleForInterestAccrual: async () => [{ accountId: 'acc-1', status: 'ACTIVE', productCode: 'SAVINGS' }],
      hasDepositAccrualForAccountAndDate: async () => true
    };
    
    const testApp = new DepositInterestAccrualApplication(
      testAdapter as unknown as PostgresAccountAdapter,
      mockInterestEvents as unknown as InterestEventsPublisher,
      mockLogger
    );
    const result = await testApp.processDailyAccrual();
    
    assert.strictEqual(result.processedCount, 0);
    assert.strictEqual(result.skippedCount, 1);
  });

  test('processDailyAccrual processes eligible accounts', async () => {
    const testAdapter = {
      ...mockPostgresAdapter,
      findAccountsEligibleForInterestAccrual: async () => [{ accountId: 'acc-1', status: 'ACTIVE', productCode: 'SAVINGS' }],
      getBalanceSnapshot: async () => 1000000, // 10,000 USD
      hasDepositAccrualForAccountAndDate: async () => false
    };
    
    let emitted = false;
    const testEvents = {
      emitInterestAccrued: async () => { emitted = true; }
    } satisfies InterestEventsPort;
    
    const testApp = new DepositInterestAccrualApplication(
      testAdapter as unknown as PostgresAccountAdapter,
      testEvents as unknown as InterestEventsPublisher,
      mockLogger
    );
    const result = await testApp.processDailyAccrual('2026-04-15');
    
    assert.strictEqual(result.processedCount, 1);
    // (1000000 * 0.02) / 365 = 20000 / 365 = 54.79... => 55 cents
    assert.strictEqual(result.totalAccruedCents, 55);
    assert.strictEqual(emitted, true);
  });

  test('processDailyAccrual handles failure safely', async () => {
    const testAdapter = {
      ...mockPostgresAdapter,
      findAccountsEligibleForInterestAccrual: async () => [{ accountId: 'acc-1', status: 'ACTIVE', productCode: 'SAVINGS' }],
      getBalanceSnapshot: async () => { throw new Error('DB Error'); }
    };
    
    const testApp = new DepositInterestAccrualApplication(
      testAdapter as unknown as PostgresAccountAdapter,
      mockInterestEvents as unknown as InterestEventsPublisher,
      mockLogger
    );
    const result = await testApp.processDailyAccrual();
    
    assert.strictEqual(result.failureCount, 1);
    assert.strictEqual(result.processedCount, 0);
  });
});
