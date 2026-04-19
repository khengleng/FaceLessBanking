import assert from 'node:assert/strict';
import test from 'node:test';
import { NIIApplication } from '../application/nii.application.js';
import { IrrEngineAdapterStub, AccountingAdapterStub } from '../adapters/nii-adapters.js';

test('NII Sensitivity Engine Logic', async (t) => {
  const irrAdapter = new IrrEngineAdapterStub();
  const accAdapter = new AccountingAdapterStub();
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  const app = new NIIApplication(irrAdapter, accAdapter, logger);

  // Baseline NII is $1M (100,000,000 cents)
  // Gaps from stub:
  // 0-30d: +$5M gap, 0.96y rem => +48k marginal NII per 100bps
  // 31-90d: -$2M gap, 0.83y rem => -16.6k
  // 3-6m: +$1M gap, 0.62y rem => +6.2k
  // 6-12m: -$0.5M gap, 0.25y rem => -1.25k
  // Net Impact of +100bps ≅ +36.35k

  await t.test('calculates parallel up 100 bps correctly', async () => {
    const result = await app.calculateShockImpact('USD', {
      scenarioId: 'TEST_UP_100',
      name: 'Test Up',
      basisPointsShift: 100
    });

    const expectedDelta = (5000000 * 0.01 * 0.96) 
                        + (-2000000 * 0.01 * 0.83) 
                        + (1000000 * 0.01 * 0.62) 
                        + (-500000 * 0.01 * 0.25);
    
    // Allow small rounding differences due to BigInt conversion
    const actualDeltaNumber = Number(result.projectedNiiDeltaCents);
    const diff = Math.abs(actualDeltaNumber - expectedDelta);
    
    assert.ok(diff < 5000, `Delta ${actualDeltaNumber} is too far from expected ${expectedDelta}`);
    assert.ok(result.projectedNiiDeltaCents > 0n); // It's an asset-sensitive book
  });

  await t.test('calculates parallel down 100 bps correctly', async () => {
    const result = await app.calculateShockImpact('USD', {
      scenarioId: 'TEST_DOWN_100',
      name: 'Test Down',
      basisPointsShift: -100
    });

    assert.ok(result.projectedNiiDeltaCents < 0n); // Rates drop -> NII drops on asset sensitive book
  });
});
