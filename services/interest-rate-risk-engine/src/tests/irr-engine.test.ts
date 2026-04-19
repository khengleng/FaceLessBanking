import assert from 'node:assert/strict';
import test from 'node:test';
import { IRRApplication } from '../application/irr.application.js';
import { PostgresIRRAdapter } from '../adapters/postgres-irr.adapter.js';
import type { RateSensitivePosition } from '../domain/irr.js';

test('Interest Rate Risk Engine Business Logic', async (t) => {
  const postgresAdapter = new PostgresIRRAdapter();
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  const app = new IRRApplication(postgresAdapter, logger);

  await t.test('calculates repricing gaps correctly for USD', async () => {
    const buckets = await app.calculateRepricingGaps('USD');
    
    // 0-30 Days: 
    // Asset: loan-1 ($10k)
    // Liab: dep-1 ($15k)
    // Gap: -$5k
    const shortBucket = buckets.find(b => b.bucketName === '0_30_DAYS');
    assert.equal(shortBucket?.gap, -500000n);

    // 31-90 Days:
    // Asset: loan-2 ($20k)
    // Liab: 0
    // Gap: +$20k
    // Cumulative: -$5k + $20k = +$15k
    const midBucket = buckets.find(b => b.bucketName === '31_90_DAYS');
    assert.equal(midBucket?.gap, 2000000n);
    assert.equal(midBucket?.cumulativeGap, 1500000n);
  });

  await t.test('handles empty datasets safely', async () => {
    const emptyAdapter: {
      fetchRateSensitiveLoanPositions: () => Promise<RateSensitivePosition[]>;
      fetchRateSensitiveDepositPositions: () => Promise<RateSensitivePosition[]>;
      fetchTreasuryRateSensitivePositions: () => Promise<RateSensitivePosition[]>;
    } = {
      fetchRateSensitiveLoanPositions: async () => [],
      fetchRateSensitiveDepositPositions: async () => [],
      fetchTreasuryRateSensitivePositions: async () => []
    };
    
    const emptyApp = new IRRApplication(emptyAdapter, logger);
    const result = await emptyApp.calculateRepricingGaps('USD');
    assert.equal(result.length, 6);
    assert.ok(result.every(b => b.gap === 0n));

    const niiResult = await emptyApp.calculateNIISensitivity('USD', 100);
    assert.equal(niiResult.baseNii, '0');
    assert.equal(niiResult.shockedNii, '0');
    assert.equal(niiResult.deltaNii, '0');
  });

  await t.test('calculates NII sensitivity impact for parallel shocks', async () => {
    // Current mock book:
    // Assets: loan-1 ($10k @ 5%), loan-2 ($20k @ 6.5%), loan-3 ($50k @ 4%)
    // Base Asset NII Annualized: $500 + $1,300 + $2,000 = $3,800 (380,000 cents)
    // Liabs: dep-1 ($15k @ 2%), dep-2 ($30k @ 1%) 
    // Base Liab Exp Annualized: $300 + $300 = $600 (60,000 cents)
    // Net Base NII: $3,200 (320,000 cents)

    const baseResult = await app.calculateNIISensitivity('USD', 0);
    assert.equal(baseResult.baseNii, '320000');
    assert.equal(baseResult.deltaNii, '0');

    // +100 bps Shock:
    // Assets (+100 bps on $80k) = +$800 NII
    // Liabs (+100 bps on $45k) = +$450 Expense
    // Net Delta: +$350 (35,000 cents)
    
    const up100Result = await app.calculateNIISensitivity('USD', 100);
    assert.equal(up100Result.deltaNii, '35000');
    assert.equal(up100Result.shockedNii, '355000'); // 320k + 35k

    // -100 bps Shock:
    // Net Delta: -$350 (-35,000 cents)
    const down100Result = await app.calculateNIISensitivity('USD', -100);
    assert.equal(down100Result.deltaNii, '-35000');
    assert.equal(down100Result.shockedNii, '285000'); // 320k - 35k
  });

  await t.test('scenario framework executes standard scenarios successfully', async () => {
    const list = app.getScenarios();
    assert.equal(list.length, 6);
    assert.ok(list.find(s => s.scenarioId === 'UP_100_BPS'));

    const result = await app.runScenario({
      scenarioId: 'UP_100_BPS',
      currency: 'USD'
    });
    assert.equal(result.scenarioId, 'UP_100_BPS');
    assert.equal(result.niiDelta, '35000'); // Validates it cascaded down into the test logic above correctly
    assert.match(result.notes, /Parallel/);

    const persisted = await app.getScenarioResult('UP_100_BPS', 'USD');
    assert.ok(persisted);
    assert.equal(persisted?.niiDelta, '35000');
  });
});
