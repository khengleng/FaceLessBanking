import assert from 'node:assert/strict';
import test from 'node:test';
import { ALMApplication } from '../application/alm.application.js';
import { PostgresALMAdapter } from '../adapters/postgres-alm.adapter.js';
import type { ScheduledCashFlow } from '../domain/alm.js';

type ALMAdapterPort = Pick<
  PostgresALMAdapter,
  | 'fetchLoanPositions'
  | 'fetchDepositPositions'
  | 'fetchTreasuryPositions'
  | 'fetchLoanSchedules'
  | 'fetchDepositMaturities'
>;

test('ALM Position Aggregation Logic', async (t) => {
  const postgresAdapter = new PostgresALMAdapter();
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  const app = new ALMApplication(postgresAdapter, logger);

  await t.test('aggregates assets and liabilities correctly', async () => {
    const positions = await app.aggregatePositions();
    const usd = positions.find(p => p.currency === 'USD');

    // Expected USD:
    // Assets: $500k (Loan) + $100k (Treasury) = $600k (60,000,000 cents)
    // Liabs: $450k (Deposit) + $20k (Treasury) = $470k (47,000,000 cents)
    // Net: $130k (13,000,000 cents)
    assert.equal(usd?.totalAssetsCents, 60000000n);
    assert.equal(usd?.totalLiabilitiesCents, 47000000n);
    assert.equal(usd?.netPositionCents, 13000000n);
  });

  await t.test('handles multi-currency isolation', async () => {
    const positions = await app.aggregatePositions();
    assert.equal(positions.length, 2);
    assert.ok(positions.find(p => p.currency === 'USD'));
    assert.ok(positions.find(p => p.currency === 'EUR'));
  });

  await t.test('handles empty datasets safely', async () => {
    const emptyAdapter = {
      fetchLoanPositions: async () => [],
      fetchDepositPositions: async () => [],
      fetchTreasuryPositions: async () => [],
      fetchLoanSchedules: async (): Promise<ScheduledCashFlow[]> => [],
      fetchDepositMaturities: async (): Promise<ScheduledCashFlow[]> => []
    } satisfies ALMAdapterPort;
    
    const emptyApp = new ALMApplication(emptyAdapter, logger);
    const result = await emptyApp.aggregatePositions();
    assert.equal(result.length, 0);
  });

  await t.test('calculates maturity buckets correctly', async () => {
    const positions = await app.calculateMaturityBuckets('USD');
    
    // Based on PostgresALMAdapter:
    // Loan Inflow: $5k in 9 days (8_30_DAYS), $12k in 45 days (1_3_MONTHS)
    // Deposit Outflow: $30k in 5 days (0_7_DAYS)
    
    const shortTerm = positions.find(p => p.bucketKey === '0_7_DAYS');
    const mediumTerm = positions.find(p => p.bucketKey === '8_30_DAYS');
    const quarterly = positions.find(p => p.bucketKey === '1_3_MONTHS');

    assert.equal(shortTerm?.outflowCents, 3000000n);
    assert.equal(mediumTerm?.inflowCents, 500000n);
    assert.equal(quarterly?.inflowCents, 1200000n);
    
    // Net Gap check for 0-7 days: Inflow(0) - Outflow(30k) = -30k
    assert.equal(shortTerm?.netGapCents, -3000000n);
  });

  await t.test('calculates risk metrics correctly', async () => {
    const metrics = await app.calculateRiskMetrics('USD');
    assert.ok(metrics);
    
    // Position Engine: Assets=$600k, Liabs=$470k -> Gap=$130k
    // Ratio: 600/470 = ~1.2766
    assert.equal(metrics?.liquidityGapCents, '13000000');
    assert.ok(Math.abs(metrics.alRatio - 1.2766) < 0.001);
    
    // Short term gap: Inflow=$5k (8-30d), Outflow=$30k (0-7d) -> Gap = -$25k
    assert.equal(metrics?.shortTermGapCents, '-2500000');
    
    // Funding coverage: 5k/30k = ~0.1666
    assert.ok(Math.abs(metrics.fundingCoverageRatio - 0.1666) < 0.001);
  });
});
